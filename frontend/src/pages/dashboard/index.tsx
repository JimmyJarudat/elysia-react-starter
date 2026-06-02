const DashboardPage = () => {
  const cards = [
    { label: "Active menus", value: "3", helper: "Mock navigation" },
    { label: "Sub menus", value: "3", helper: "Expandable sidebar" },
    { label: "Data source", value: "Mock", helper: "Ready for API later" },
  ];

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
        <span className="status-pill">Running</span>
      </div>

      <div className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </article>
        ))}
      </div>

      <article className="content-panel">
        <h2>Layout context route</h2>
        <p>
          หน้านี้ใช้ข้อมูลจำลองเพื่อเช็ก shell ก่อน: sidebar ย่อ/ขยายได้, submenu เปิดปิดได้, navbar ยังอยู่โครงเดิม
          และไม่มี desktop view mode แล้ว
        </p>
      </article>
    </section>
  );
};

export default DashboardPage;
