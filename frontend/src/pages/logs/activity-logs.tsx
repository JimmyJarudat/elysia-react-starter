const ActivityLogsPage = () => (
  <section className="grid gap-5">
    <div>
      <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Logs</p>
      <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">Activity Logs</h1>
    </div>
    <article className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
      <p className="text-slate-500 dark:text-slate-400">บันทึกกิจกรรมที่ผู้ใช้งานดำเนินการ เช่น Create, Update, Delete, Approve, Reject — ยังไม่ได้พัฒนา</p>
    </article>
  </section>
);

export default ActivityLogsPage;
