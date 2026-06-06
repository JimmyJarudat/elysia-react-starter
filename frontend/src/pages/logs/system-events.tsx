const SystemEventsPage = () => (
  <section className="grid gap-5">
    <div>
      <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Logs</p>
      <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">System Events</h1>
    </div>
    <article className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
      <p className="text-slate-500 dark:text-slate-400">บันทึกเหตุการณ์ระดับระบบ เช่น Scheduler, Queue Jobs, Cache Events, Email Jobs — ยังไม่ได้พัฒนา</p>
    </article>
  </section>
);

export default SystemEventsPage;
