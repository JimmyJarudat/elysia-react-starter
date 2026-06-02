interface PlaceholderPageProps {
  title?: string;
}

const PlaceholderPage = ({ title = "Page" }: PlaceholderPageProps) => {
  return (
    <section className="grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Mock page</p>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">{title}</h1>
        </div>
      </div>
      <article className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title} content</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">วางหน้า placeholder ไว้ก่อน เพื่อให้ route และเมนูทดลองทำงานครบ flow</p>
      </article>
    </section>
  );
};

export default PlaceholderPage;
