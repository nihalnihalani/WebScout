import Link from "next/link";
import {
  Activity,
  Brain,
  Zap,
  Target,
  ArrowRight,
  Globe,
  Database,
  Eye,
  Shield,
  TrendingUp,
  Sparkles,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Cpu,
  Clock,
  RefreshCw,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Navigate",
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    description: "Cloud browser loads target page via Browserbase",
  },
  {
    number: "02",
    title: "Extract",
    icon: Target,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    description: "Stagehand AI extracts the data you need",
  },
  {
    number: "03",
    title: "Learn",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    description: "Failed? Multi-strategy recovery finds what works",
  },
  {
    number: "04",
    title: "Remember",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    description: "Pattern stored in Redis for instant reuse",
  },
];

const metrics = [
  {
    label: "Cache Hit Rate",
    value: "0% → 83%",
    icon: TrendingUp,
    color: "text-emerald-400",
    description: "Early tasks start cold — later tasks hit the vector cache instantly",
  },
  {
    label: "Speed Improvement",
    value: "3.2x",
    icon: Shield,
    color: "text-blue-400",
    description: "Cached extractions complete in seconds instead of minutes",
  },
  {
    label: "Recovery Strategies",
    value: "4",
    icon: Brain,
    color: "text-purple-400",
    description: "Agent, blocker removal, refined extraction, and Gemini analysis",
  },
];

const sponsors = [
  {
    name: "Weights & Biases / Weave",
    icon: Eye,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    description: "Full trace observability — every agent decision tracked",
  },
  {
    name: "Redis + RediSearch",
    icon: Database,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    description:
      "Vector similarity search for pattern matching with HNSW",
  },
  {
    name: "Browserbase + Stagehand",
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    description: "Cloud browsers with AI-powered extraction",
  },
  {
    name: "OpenAI",
    icon: Sparkles,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    description: "Embeddings for semantic pattern matching",
  },
  {
    name: "Vercel",
    icon: Zap,
    color: "text-white",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    description: "Edge-optimized deployment",
  },
];

const loopSteps = [
  { label: "Extract", icon: Target },
  { label: "Fail", icon: RefreshCw },
  { label: "Recover", icon: Shield },
  { label: "Learn", icon: Brain },
  { label: "Cache", icon: Database },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* ========== HERO SECTION ========== */}
      <section className="relative">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Gradient glow behind hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-24">
          {/* Nav bar */}
          <nav className="flex items-center justify-between mb-24">
            <div className="flex items-center gap-2.5">
              <Activity className="w-7 h-7 text-emerald-500" />
              <span className="text-lg font-bold tracking-tight">
                WebScout
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="https://github.com/nihalnihalani/webscout"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="/dashboard"
                className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </nav>

          {/* Hero content */}
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">
                Self-Improving Browser Agent
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Every Failed Click{" "}
              <span className="bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Makes It Smarter
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              A self-improving browser automation agent that learns extraction
              patterns from failures, caches them with vector search, and gets
              faster over time.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25"
              >
                Open Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="https://github.com/nihalnihalani/webscout"
                className="inline-flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 py-3.5 rounded-xl transition-all"
              >
                <GitBranch className="w-4 h-4" />
                View on GitHub
              </Link>
            </div>
          </div>

          {/* Floating stats under hero */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: "Strategies", value: "5+", icon: Cpu },
              { label: "Recovery Steps", value: "Multi", icon: RefreshCw },
              { label: "Vector Cache", value: "HNSW", icon: Database },
              { label: "Full Traces", value: "Weave", icon: Eye },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center backdrop-blur-sm"
              >
                <stat.icon className="w-4 h-4 text-emerald-500 mx-auto mb-2" />
                <div className="text-lg font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Four steps. One intelligent loop. WebScout navigates, extracts,
              learns from failures, and remembers what works.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.number} className="relative group">
                {/* Connector line on larger screens */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-linear-to-r from-zinc-700 to-transparent z-0" />
                )}
                <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center`}
                    >
                      <step.icon className={`w-5 h-5 ${step.color}`} />
                    </div>
                    <span className="text-xs font-mono text-zinc-600">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== THE SELF-IMPROVING LOOP ========== */}
      <section className="relative border-t border-zinc-800/50">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-500/[0.02] to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-400 tracking-wide uppercase">
                Core Innovation
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The Self-Improving Loop
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Every failure teaches WebScout something new. Recovered patterns
              are embedded and cached so the same failure never happens twice.
            </p>
          </div>

          {/* Loop visualization */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16 max-w-3xl mx-auto">
            {loopSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
                  <step.icon className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-zinc-300">
                    {step.label}
                  </span>
                </div>
                {i < loopSteps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                )}
              </div>
            ))}
            {/* Loop-back arrow */}
            <div className="flex items-center gap-3">
              <ChevronRight className="w-4 h-4 text-zinc-600" />
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Repeat
                </span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                  <span className="text-sm font-medium text-zinc-300">
                    {metric.label}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-2">
                  {metric.value}
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TECH STACK / SPONSOR INTEGRATION ========== */}
      <section className="relative border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built With the Best
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Every sponsor technology plays a critical role in the
              self-improving loop.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {sponsors.map((sponsor) => (
              <div
                key={sponsor.name}
                className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 shrink-0 rounded-xl ${sponsor.bg} border ${sponsor.border} flex items-center justify-center`}
                  >
                    <sponsor.icon
                      className={`w-5 h-5 ${sponsor.color}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1.5 leading-tight">
                      {sponsor.name}
                    </h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      {sponsor.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Architecture highlight card */}
            <div className="bg-linear-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Full Architecture
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Navigate, extract, recover, learn, and cache -- all traced
                end-to-end with Weave observability.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                See it in action
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE HIGHLIGHTS ========== */}
      <section className="relative border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Why WebScout{" "}
                <span className="bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Wins
                </span>
              </h2>
              <div className="space-y-4">
                {[
                  "Failures become cached knowledge, not dead ends",
                  "Vector similarity finds relevant patterns in milliseconds",
                  "Multi-strategy fallback ensures maximum extraction success",
                  "Full Weave traces for every decision the agent makes",
                  "Gets measurably faster with each task it runs",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 text-sm leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code/terminal preview card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <span className="text-xs text-zinc-500 ml-2 font-mono">
                  webscout-agent.log
                </span>
              </div>
              <div className="p-5 font-mono text-xs leading-relaxed space-y-2">
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:01]</span>{" "}
                  <span className="text-blue-400">NAV</span> Loading
                  target page...
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:03]</span>{" "}
                  <span className="text-emerald-400">EXTRACT</span>{" "}
                  Attempting primary selector...
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:04]</span>{" "}
                  <span className="text-red-400">FAIL</span> Selector
                  not found on page
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:04]</span>{" "}
                  <span className="text-purple-400">RECOVER</span>{" "}
                  Trying strategy 2: AI extraction...
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:06]</span>{" "}
                  <span className="text-emerald-400">SUCCESS</span>{" "}
                  Data extracted via Stagehand
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:06]</span>{" "}
                  <span className="text-amber-400">CACHE</span> Pattern
                  saved to Redis{" "}
                  <span className="text-zinc-600">
                    (similarity: 0.97)
                  </span>
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600">[00:07]</span>{" "}
                  <span className="text-yellow-400">TRACE</span> Weave
                  span recorded
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-800 text-emerald-400">
                  <Clock className="w-3 h-3 inline mr-1.5 -mt-0.5" />
                  Next run will use cached pattern (est. 2x faster)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="relative border-t border-zinc-800/50">
        <div className="absolute inset-0 bg-linear-to-t from-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See the Loop in Action
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8">
            Run a task, watch it learn, and see recovery patterns appear in
            real time.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-zinc-800/50 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold text-white">
                WebScout
              </span>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-sm text-zinc-400">
                Built for{" "}
                <span className="text-white font-medium">
                  WeaveHacks 3
                </span>{" "}
                -- Self-Improving Agents Hackathon
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Powered by the self-improving loop
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
