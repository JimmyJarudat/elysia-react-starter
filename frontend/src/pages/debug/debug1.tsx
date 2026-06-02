interface PlaceholderPageProps {
  title?: string;
}

const PlaceholderPage = ({ title = "Page" }: PlaceholderPageProps) => {
  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Mock page</p>
          <h1>{title}</h1>
        </div>
      </div>
      <article className="content-panel">
        <h2>{title} content</h2>
        <p>วางหน้า placeholder ไว้ก่อน เพื่อให้ route และเมนูทดลองทำงานครบ flow</p>
      </article>
    </section>
  );
};

export default PlaceholderPage;
