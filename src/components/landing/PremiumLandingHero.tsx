import React from 'react';
import { ArrowRight, Camera, Check, FileUp, Mic, ShieldCheck } from 'lucide-react';

const hero = '/assets/hero/marketplace-desktop.webp';
const shop = '/assets/story/stock-shop.webp';
const farm = '/assets/story/show-farm.webp';
const tailor = '/assets/story/talk-tailoring.webp';

const plans = [
  ['Free', '₦0', '3 voice commands/day'],
  ['Starter', '₦5,000', '8 voice commands/day'],
  ['Pro', '₦10,000', '50 voice commands/day'],
  ['Business', '₦25,000', '100 voice commands/day'],
  ['Enterprise', '₦100,000+', 'Unlimited voice AI'],
] as const;

const simpleSteps = [
  { icon: Mic, title: 'Speak', text: 'Say what happened and turn it into a business record.' },
  { icon: Camera, title: 'Snap', text: 'Use the live camera for receipts, products, documents and evidence.' },
  { icon: FileUp, title: 'Upload', text: 'Bring in a photo or PDF you already have.' },
] as const;

const PremiumLandingHero: React.FC = () => (
  <main className="min-h-full bg-[#f4f1e8] text-[#17202b]">
    <header className="border-b border-[#17202b]/10 bg-[#f4f1e8]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border-2 border-[#17202b] bg-[#e3b34b] text-[#17202b]"><ShieldCheck className="h-5 w-5" /></div>
          <div><div className="font-serif text-xl font-black tracking-tight">BizGuard</div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#17202b]/50">Business operating system</div></div>
        </div>
        <div className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[.14em] text-[#17202b]/65 md:flex"><span>Sales</span><span>Stock</span><span>Customers</span><span>Decisions</span></div>
        <a href="/login" className="border-2 border-[#17202b] bg-[#17202b] px-4 py-2.5 text-xs font-black uppercase tracking-[.12em] text-white hover:bg-[#293545]">Sign in</a>
      </div>
    </header>

    <section className="mx-auto grid max-w-7xl border-x border-[#17202b]/10 lg:grid-cols-[.9fr_1.1fr]">
      <div className="flex min-h-[520px] flex-col justify-between border-b border-[#17202b]/10 bg-[#17202b] p-7 text-white sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
        <div><p className="text-[11px] font-black uppercase tracking-[.25em] text-[#e3b34b]">Built for the person doing the work</p><h1 className="mt-7 max-w-2xl font-serif text-[3.25rem] font-black leading-[.9] tracking-[-.045em] sm:text-7xl lg:text-[6.4rem]">Run the business.<br /><span className="text-[#e3b34b]">Not the software.</span></h1><p className="mt-8 max-w-xl text-lg leading-8 text-white/70">BizGuard keeps sales, stock, customers, debtors and business decisions in one straightforward place. Speak when speaking is faster. Snap when seeing is faster. Type when typing is faster.</p></div>
        <div className="mt-12 flex flex-wrap gap-2"><a href="/login" className="inline-flex items-center gap-2 bg-white px-5 py-3.5 text-sm font-black text-[#17202b]">Start using BizGuard <ArrowRight className="h-4 w-4" /></a><a href="#how" className="border border-white/25 px-5 py-3.5 text-sm font-bold text-white hover:bg-white/10">See how it works</a></div>
      </div>

      <div className="relative min-h-[420px] sm:min-h-[520px] overflow-hidden bg-[#d8d0c0] p-4 sm:p-7">
        <div className="grid h-full grid-cols-12 grid-rows-12 gap-3">
          <div className="col-span-8 row-span-8 overflow-hidden border-4 border-[#f4f1e8] shadow-[10px_10px_0_#17202b]"><img src={hero} alt="African businesses and trade" className="h-full w-full object-cover" fetchPriority="high" /></div>
          <div className="col-span-4 row-span-5 overflow-hidden border-4 border-[#f4f1e8]"><img src={shop} alt="Shop and stock" className="h-full w-full object-cover" /></div>
          <div className="col-span-4 row-span-7 overflow-hidden border-4 border-[#f4f1e8]"><img src={farm} alt="Farm business" className="h-full w-full object-cover" /></div>
          <div className="col-span-8 row-span-4 overflow-hidden border-4 border-[#f4f1e8]"><img src={tailor} alt="People building a business" className="h-full w-full object-cover" /></div>
        </div>
        <div className="absolute bottom-4 left-4 sm:bottom-10 sm:left-10 bg-[#e3b34b] px-4 py-3 text-sm font-black uppercase tracking-[.12em] text-[#17202b] shadow-[6px_6px_0_#17202b]">Speak · Snap · Upload · Done</div>
      </div>
    </section>

    <section id="how" className="mx-auto max-w-7xl border-x border-b border-[#17202b]/10 bg-[#f4f1e8] px-5 py-16 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.25em] text-[#17202b]/45">The working principle</p><h2 className="mt-3 font-serif text-4xl font-black leading-none tracking-[-.04em]">Three ways in.<br />One place out.</h2></div><p className="max-w-xl text-base leading-7 text-[#17202b]/65">The interface should disappear while you work. BizGuard is designed around the things a business owner actually does—not around a catalogue of software features.</p></div>
      <div className="mt-12 grid border-y border-[#17202b]/10 md:grid-cols-3">
        {simpleSteps.map(({ icon: Icon, title, text }, i) => <article key={title} className="border-b border-[#17202b]/10 p-7 md:border-b-0 md:border-r md:last:border-r-0"><div className="flex items-center justify-between"><Icon className="h-6 w-6" /><span className="font-serif text-3xl font-black text-[#17202b]/15">0{i+1}</span></div><h3 className="mt-10 font-serif text-2xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#17202b]/60">{text}</p></article>)}
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl border-x border-b border-[#17202b]/10 lg:grid-cols-[1.1fr_.9fr]">
      <div className="border-b border-[#17202b]/10 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14"><p className="text-[11px] font-black uppercase tracking-[.25em] text-[#17202b]/45">The home screen</p><h2 className="mt-4 max-w-2xl font-serif text-4xl font-black leading-[.92] tracking-[-.04em]">The first screen should answer one question:</h2><p className="mt-5 font-serif text-3xl font-bold text-[#b47b16]">“What do I need to do now?”</p><div className="mt-8 grid gap-2 sm:grid-cols-2">{['Record a sale','Add stock','Record a debt','Check today','Ask BizGuard','View reports'].map((item) => <div key={item} className="flex items-center gap-3 border border-[#17202b]/10 bg-white px-4 py-3 text-sm font-bold"><span className="grid h-6 w-6 place-items-center bg-[#17202b] text-white"><Check className="h-3.5 w-3.5" /></span>{item}</div>)}</div></div>
      <div className="min-h-[480px] overflow-hidden"><img src={shop} alt="Business owner managing stock" className="h-full w-full object-cover" /></div>
    </section>

    <section className="mx-auto max-w-7xl border-x border-b border-[#17202b]/10 bg-white px-5 py-16 lg:px-8"><div className="flex flex-col gap-3 border-b border-[#17202b]/10 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.25em] text-[#17202b]/45">Subscription</p><h2 className="mt-2 font-serif text-3xl font-black sm:text-4xl">Start free. Pay only when you need more.</h2></div><p className="max-w-sm text-sm leading-6 text-[#17202b]/55">Choose a subscription plan first. Payment account details appear only after you select a paid plan, then you can submit proof for administrator approval.</p></div><div className="mt-7 grid divide-y border-y border-[#17202b]/10 sm:grid-cols-5 sm:divide-x sm:divide-y-0">{plans.map(([name,price,detail]) => <div key={name} className="p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#17202b]/45">{name}</p><p className="mt-3 font-serif text-2xl font-black">{price}</p><p className="mt-1 text-xs leading-5 text-[#17202b]/55">{detail}</p></div>)}</div><div className="mt-7 grid gap-5 border-t border-[#17202b]/10 pt-7 sm:grid-cols-2 lg:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#17202b]/45">Phone</p><a href="tel:07050480997" className="mt-1 block text-sm font-black hover:underline">07050480997</a></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#17202b]/45">Email</p><a href="mailto:goodshareintercontinentalventures@hotmail.com" className="mt-1 block break-all text-sm font-black hover:underline">goodshareintercontinentalventures@hotmail.com</a></div><a href="/login" className="inline-flex items-center justify-center bg-[#17202b] px-5 py-3 text-sm font-black text-white">Sign in to choose a plan <ArrowRight className="ml-2 h-4 w-4" /></a></div></section>

    <footer className="mx-auto grid max-w-7xl gap-3 border-x border-[#17202b]/10 px-5 py-7 text-xs font-bold uppercase tracking-[.12em] text-[#17202b]/45 sm:flex sm:items-center sm:justify-between lg:px-8"><span>BizGuard</span><span>Support: 07050480997 · goodshareintercontinentalventures@hotmail.com</span><span>Business, made simple.</span></footer>
  </main>
);

export default PremiumLandingHero;
