import { getOfficialMessages, type OfficialLocale } from "@/i18n/official";

export function getOfficialHomeContent(locale: OfficialLocale) {
  const home = getOfficialMessages(locale).home;
  return {
    hero: home.hero,
    compatibility: home.compatibility,
    features: home.features,
    workflow: home.workflow.steps,
    xiangseSteps: home.xiangse.steps,
    freeNotice: home.final.notice,
  } as const;
}

const defaultHome = getOfficialHomeContent("zh");

export const OFFICIAL_HERO = defaultHome.hero;
export const OFFICIAL_COMPATIBILITY = defaultHome.compatibility;
export const OFFICIAL_FEATURES = defaultHome.features;
export const OFFICIAL_WORKFLOW = defaultHome.workflow;
export const XIANGSE_INSTALL_STEPS = defaultHome.xiangseSteps;
export const OFFICIAL_FREE_NOTICE = defaultHome.freeNotice;
