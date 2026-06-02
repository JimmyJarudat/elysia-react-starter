const DashboardPage = () => {
  const cards = [
    { label: "Active menus", value: "3", helper: "Mock navigation" },
    { label: "Sub menus", value: "3", helper: "Expandable sidebar" },
    { label: "Data source", value: "Mock", helper: "Ready for API later" },
  ];

  return (
    <section className="grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Overview</p>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">Dashboard</h1>
        </div>
        <span className="inline-flex items-center justify-center rounded-md bg-ocean-100 px-3 py-2 text-sm font-bold text-ocean-700 dark:bg-slate-blue-800 dark:text-dark-primary">
          Running
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <article className="grid min-h-36 gap-2 rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card" key={card.label}>
            <span className="text-light-text-muted dark:text-dark-text-muted">{card.label}</span>
            <strong className="text-4xl leading-none text-light-text dark:text-dark-text">{card.value}</strong>
            <small className="text-light-text-muted dark:text-dark-text-muted">{card.helper}</small>
          </article>
        ))}
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Layout context route</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          หน้านี้ใช้ข้อมูลจำลองเพื่อเช็ก shell ก่อน: sidebar ย่อ/ขยายได้, submenu เปิดปิดได้, navbar ยังอยู่โครงเดิม
          และไม่มี desktop view mode แล้ว
        </p>
      </article>
    </section>
  );
};

export default DashboardPage;
