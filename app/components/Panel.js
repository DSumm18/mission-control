export default function Panel({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/50 p-4 shadow-panel backdrop-blur-md ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <h2 className="font-mono text-sm uppercase tracking-wider text-slate-300">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
