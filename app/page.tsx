import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>Mission Control v1</h1>
      <p>Production MVP (Next.js + Supabase + LLMAdapter)</p>
      <ul>
        <li><Link href="/projects">Projects</Link></li>
        <li><Link href="/decisions">Decisions Inbox</Link></li>
        <li><Link href="/activity">Activity Log</Link></li>
        <li><Link href="/creative-studio">Creative Studio</Link></li>
        <li><Link href="/jobs">Jobs</Link></li>
      </ul>
    </main>
  );
}
