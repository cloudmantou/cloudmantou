import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const allowed = new Set(['xiaoxi-jizhang', 'xiaoxi-jizhang-privacy', 'xiaoxi-jizhang-support']);
const contentDir = new URL('../src/content/xiaoxi-jizhang/', import.meta.url);
const articles = await Promise.all((await readdir(contentDir)).filter(n => n.endsWith('.json')).map(async n => JSON.parse(await readFile(new URL(n, contentDir), 'utf8'))));
if (articles.length !== 3 || new Set(articles.map(a => a.slug)).size !== 3) throw new Error('Expected exactly three unique product pages');
for (const a of articles) {
  if (!allowed.has(a.slug) || !a.title.startsWith('小西记账') || !a.content?.trim()) throw new Error('Invalid product page');
  if (a.content.length > 100000 || a.excerpt.length > 500 || a.seoDescription.length > 160) throw new Error('Content exceeds editor limits');
  if (/TODO|PLACEHOLDER|yourdomain\.com/.test(a.content)) throw new Error('Unfinished content');
}
const english = new Map(await Promise.all(articles.map(async a => {
  const copy = JSON.parse(await readFile(new URL(`en/${a.slug}.json`, contentDir), 'utf8'));
  if (copy.slug !== a.slug || !copy.title || !copy.content || copy.seoDescription.length > 160) throw new Error('Invalid English translation');
  return [a.slug, copy];
})));
function sourceHash(p) {
  return createHash('sha256').update(JSON.stringify({title:p.title,excerpt:p.excerpt,content:p.content,seoTitle:p.seoTitle,seoDescription:p.seoDescription,seoKeywords:[...new Set((p.seoKeywords??[]).filter(v=>typeof v==='string'))].sort(),socialTitle:p.socialTitle,socialDescription:p.socialDescription,status:p.status}),'utf8').digest('hex');
}
if (!process.argv.includes('--publish')) {
  console.log(JSON.stringify({ mode: 'preview', pages: articles.map(({slug,title})=>({slug,title,url:`https://cloudmantoua.top/post/${slug}`})) },null,2));
} else {
  const backupArg = process.argv.find(a => a.startsWith('--backup-dir='));
  if (!backupArg) throw new Error('Publishing requires --backup-dir outside the public web root');
  const backupDir = resolve(backupArg.slice('--backup-dir='.length));
  if (backupDir.includes('/public/') || backupDir.includes('/uploads/')) throw new Error('Backup directory must not be publicly served');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.post.findMany({where:{slug:{in:[...allowed]}},include:{paidContent:true,translations:true}});
    if (existing.some(p=>!p.title.startsWith('小西记账') || p.paidContent)) throw new Error('Conflicting or paid article; no changes made');
    const author = await prisma.user.findFirst({where:{role:'ADMIN'},orderBy:{createdAt:'asc'},select:{id:true}});
    if (!author) throw new Error('No existing admin author');
    await mkdir(backupDir,{recursive:true,mode:0o700});
    await writeFile(resolve(backupDir,`xiaoxi-posts-before-${Date.now()}.json`),JSON.stringify(existing,null,2),{mode:0o600,flag:'wx'});
    const result = await prisma.$transaction(async tx => {
      const category = await tx.category.upsert({where:{slug:'product-notes'},update:{},create:{slug:'product-notes',name:'产品实践',description:'独立产品、工具开发与真实迭代记录'}});
      const rows=[];
      for(const a of articles) {
        const current=await tx.post.findUnique({where:{slug:a.slug},include:{paidContent:true,translations:true}});
        if(current && (!current.title.startsWith('小西记账') || current.paidContent)) throw new Error('Concurrent article conflict');
        const data={title:a.title,excerpt:a.excerpt,content:a.content,coverImage:a.coverImage,seoTitle:a.seoTitle,seoDescription:a.seoDescription,seoKeywords:a.seoKeywords,categoryId:category.id,status:'PUBLISHED',publishedAt:current?.publishedAt??new Date()};
        const post=await tx.post.upsert({where:{slug:a.slug},update:data,create:{...data,slug:a.slug,authorId:author.id,isTop:false}});
        if(current && current.content!==a.content) await tx.postTranslation.updateMany({where:{postId:post.id},data:{status:'STALE'}});
        const en = english.get(a.slug);
        const copy = {title:en.title,excerpt:en.excerpt,content:en.content,seoTitle:en.seoTitle,seoDescription:en.seoDescription,seoKeywords:en.seoKeywords,status:'PUBLISHED',sourceHash:sourceHash(post),sourceUpdatedAt:post.updatedAt,publishedAt:current?.translations.find(t=>t.locale==='en-US')?.publishedAt??new Date(),provider:'editorial'};
        await tx.postTranslation.upsert({where:{postId_locale:{postId:post.id,locale:'en-US'}},update:copy,create:{...copy,postId:post.id,locale:'en-US'}});
        rows.push({id:post.id,slug:post.slug,status:post.status,english:'PUBLISHED'});
      }
      return rows;
    });
    console.log(JSON.stringify({mode:'published',pages:result},null,2));
  } finally {await prisma.$disconnect();}
}
