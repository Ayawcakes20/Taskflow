import { Link } from 'react-router-dom';
import { ArrowRight, ListChecks, Columns3, CalendarDays, ChartNoAxesCombined, Bell, Users } from 'lucide-react';
import WorkspacePreview from '../../components/common/WorkspacePreview';

const features = [
  [ListChecks, 'Give every task a clear next step.', 'Create tasks, set priorities and deadlines, and break work into subtasks. Search and filter to find what matters.'],
  [Columns3, 'See work move forward.', 'Switch between your task list and Kanban board. Move tasks from pending to in progress to completed.'],
  [CalendarDays, 'Make space for what’s due.', 'Plan around deadlines with the monthly calendar and keep upcoming work in view.'],
  [Users, 'Keep everyone in the loop.', 'Assign teammates, discuss tasks in comments, and mention the people involved.'],
  [ChartNoAxesCombined, 'Turn progress into perspective.', 'Follow completion trends and explore your workload by status, priority, and category.'],
  [Bell, 'Stay close to the important details.', 'Catch assignments, updates, and deadline reminders in your notification inbox.'],
];

export default function LandingPage() {
  return <main className="public-page">
    <header className="public-nav"><Link className="brand-link" to="/" aria-label="Taskflow home"><span className="brand-mark"><span /><span /><span /></span>taskflow</Link><nav aria-label="Main navigation"><a className="public-features-link" href="#features">Features</a><Link to="/login">Log in</Link><Link className="button button-primary" to="/register">Get started <ArrowRight size={15} /></Link></nav></header>
    <section className="landing-hero"><div className="hero-copy"><span className="eyebrow">A CLEARER WAY TO WORK</span><h1>Taskflow<span>Big ideas.<br />Clear next steps.</span></h1><p>Bring your tasks, teammates, and deadlines into one focused workspace. Make progress you can see.</p><div className="hero-actions"><Link className="button button-primary button-lg" to="/register">Get started <ArrowRight size={17} /></Link><Link className="button button-secondary button-lg" to="/login">Log in to your workspace</Link></div><span className="hero-note">Plan together. Move forward.</span></div><div className="hero-preview"><WorkspacePreview /></div></section>
    <section className="landing-features" id="features"><div className="landing-section-heading"><span className="eyebrow">LESS FRICTION. MORE FOCUS.</span><h2>Everything your project<br />needs to keep moving.</h2><p>From the first task to the final presentation, keep the details connected.</p></div><div className="feature-list">{features.map(([Icon, title, description]) => <article key={title}><Icon size={23} strokeWidth={1.6} /><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="landing-cta"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>Make room for better work.</h2><p>A clear plan starts with a single task.</p></div><Link className="button button-primary button-lg" to="/register">Create your account <ArrowRight size={17} /></Link></section>
    <footer className="public-footer"><span>taskflow</span><p>Clear work, steady progress.</p><Link to="/login">Log in <ArrowRight size={14} /></Link></footer>
  </main>;
}
