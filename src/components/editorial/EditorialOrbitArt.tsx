export function EditorialOrbitArt({ label }: { label?: string }) {
  return (
    <div className="editorial-orbit-art" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="editorial-orbit-ring ring-one" />
      <span className="editorial-orbit-ring ring-two" />
      <span className="editorial-orbit-core" />
      <span className="editorial-orbit-planet planet-blue" />
      <span className="editorial-orbit-planet planet-yellow" />
      <span className="editorial-orbit-planet planet-red" />
      <span className="editorial-orbit-code">&lt;/&gt;</span>
    </div>
  );
}
