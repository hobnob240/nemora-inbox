// Shop template for client builds: a complete small-shop site whose every part is editable in the builder.
// Holloway Clay is a made-up pottery studio so the template looks like a real shop. Swap the name, products,
// prices and photos for the client's own. Photos are from Unsplash (free to use) until the client's arrive.
// The basket and checkout run on the shop link (/s/<token>) and read the product cards, so nothing else to set up.

const U = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;600;700&family=Playfair+Display:wght@500;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Merriweather:wght@400;700&family=Oswald:wght@500;700&display=swap';

// The shop pieces themselves. Also added to any other build the first time a Shop block is dropped in.
export const SHOP_CSS = `.nm-shopnote{background:#1f1d1a;color:#f3efe8;font-size:14px;text-align:center;padding:10px 16px}
.nm-basket-link{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid rgba(31,29,26,.18);border-radius:999px;text-decoration:none;font-weight:600;white-space:nowrap}
.nm-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#1f1d1a;color:#fff;font-size:13px;font-variant-numeric:tabular-nums}
.nm-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 32px}
.nm-filter{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border:1px solid rgba(31,29,26,.18);border-radius:999px;text-decoration:none;font-size:15px;cursor:pointer}
.nm-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 24px}
.nm-product{display:flex;flex-direction:column;gap:16px;min-width:0}
.nm-p-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:12px;background:#ebe6dd;display:block}
.nm-p-body{display:flex;flex-direction:column;gap:4px;flex:1}
.nm-p-cat{margin:0;font-size:14px;color:#6b645a}
.nm-p-name{margin:0;font-size:20px;font-weight:500;line-height:1.3}
.nm-p-desc{margin:0;color:#5e574e;font-size:15px}
.nm-p-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:12px}
.nm-p-price{margin:0;font-size:18px;font-variant-numeric:tabular-nums}
.nm-add{white-space:nowrap}
.nm-product[data-nm-soldout]:not([data-nm-soldout="false"]) .nm-p-img{opacity:.6}
.nm-product[data-nm-soldout]:not([data-nm-soldout="false"]) .nm-p-price:after{content:"Sold out";margin-left:10px;font-size:14px;color:#6b645a}
.nm-perks{margin-top:32px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px}
.nm-perk h3{margin:0 0 6px;font-size:18px;font-weight:500}
.nm-perk p{margin:0;color:#5e574e}
@media (max-width:900px){.nm-products{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 16px}}
@media (max-width:760px){.nm-perks{grid-template-columns:minmax(0,1fr);gap:20px}.nm-p-foot{flex-wrap:wrap}.nm-p-name{font-size:17px}}
@media (max-width:480px){.nm-products{grid-template-columns:minmax(0,1fr)}}`;

// The template's look: NEMORA's standard sections in a warm, quiet shop palette, so every builder block fits in.
const THEME_CSS = `@import url("${FONTS}");
*{box-sizing:border-box}html,body{overflow-x:clip}
body{margin:0;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:17px;color:#1f1d1a;background:#f6f2ec;line-height:1.6}
img{max-width:100%;display:block}a{color:inherit;text-underline-offset:3px}
h1,h2,h3{font-family:Lora,Georgia,serif;font-weight:500;text-wrap:balance;overflow-wrap:break-word;min-width:0}
a:focus-visible{outline:2px solid #8e4a2c;outline-offset:3px}
.nm-wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.nm-nav{background:#f6f2ec;border-bottom:1px solid rgba(31,29,26,.1);position:sticky;top:0;z-index:20}
.nm-nav-in{display:flex;align-items:center;gap:32px;min-height:72px}
.nm-logo{font-family:Lora,Georgia,serif;font-size:22px;font-weight:500;text-decoration:none;margin-right:auto}
.nm-links{display:flex;gap:28px}.nm-links a{text-decoration:none;color:#5e574e}
.nm-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;background:#8e4a2c;color:#fff;padding:0 20px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;border:1px solid transparent}
.nm-ghost{background:transparent;color:#1f1d1a;border-color:rgba(31,29,26,.25)}
.nm-hero{padding:56px 0 72px}
.nm-hero-in{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:56px;align-items:center}
.nm-hero h1{font-size:60px;line-height:1.04;margin:0 0 20px;letter-spacing:-.01em}
.nm-lead{font-size:19px;color:#5e574e;margin:0 0 32px;max-width:440px}
.nm-actions{display:flex;gap:12px;flex-wrap:wrap}
.nm-photo{width:100%;border-radius:16px;aspect-ratio:9/7;object-fit:cover}
.nm-hero .nm-photo{aspect-ratio:6/5}
.nm-section{padding:88px 0}.nm-alt{background:#efe9e0}
.nm-section h2{font-size:40px;line-height:1.12;margin:0 0 16px}
.nm-head{display:flex;align-items:end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:24px}
.nm-head h2{margin:0}.nm-head p{margin:0;color:#5e574e}
.nm-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.nm-card{background:#fff;border:1px solid rgba(31,29,26,.1);border-radius:14px;padding:24px}.nm-card h3{margin:0 0 8px}
.nm-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px;align-items:center}
.nm-split p{color:#5e574e;max-width:520px}
.nm-foot{padding:40px 0;border-top:1px solid rgba(31,29,26,.1);color:#6b645a;font-size:15px}
.nm-foot-in{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
.nm-foot a{color:#1f1d1a}
@media (max-width:900px){.nm-hero-in{grid-template-columns:minmax(0,1fr);gap:32px}.nm-hero h1{font-size:44px}}
@media (max-width:760px){.nm-links{display:none}.nm-split,.nm-grid3{grid-template-columns:minmax(0,1fr);gap:32px}.nm-hero h1{font-size:38px}.nm-hero{padding:32px 0 48px}.nm-section{padding:56px 0}.nm-section h2{font-size:32px}.nm-nav-in{gap:16px}.nm-wrap{padding:0 16px}}`;

const product = (img, alt, cat, name, desc, price, soldOut) => `<article class="nm-product" data-nm-product${soldOut ? ' data-nm-soldout="true"' : ''}><img class="nm-p-img" src="${U(img, 800)}" alt="${alt}"><div class="nm-p-body"><p class="nm-p-cat">${cat}</p><h3 class="nm-p-name">${name}</h3><p class="nm-p-desc">${desc}</p><div class="nm-p-foot"><p class="nm-p-price">${price}</p><a class="nm-btn nm-add" href="#basket" data-nm-add>Add to basket</a></div></div></article>`;

export const SHOP_TEMPLATE = {
  html: `<div class="nm-shopnote">Delivery <span data-nm-delivery>£3.95</span> anywhere in the UK, free on orders over <span data-nm-free-over>£40</span></div>
<header class="nm-nav"><div class="nm-wrap nm-nav-in"><a class="nm-logo" href="#top">Holloway Clay</a><nav class="nm-links"><a href="#shop">Shop</a><a href="#about">About</a><a href="#delivery">Delivery</a></nav><a class="nm-basket-link" href="#basket" data-nm-basket>Basket <span class="nm-count" data-nm-count>0</span></a></div></header>
<section class="nm-hero" id="top"><div class="nm-wrap nm-hero-in"><div><h1>Stoneware for the everyday table</h1><p class="nm-lead">Mugs, bowls and plates thrown by hand, glazed in small batches and packed to arrive in one piece.</p><div class="nm-actions"><a class="nm-btn" href="#shop">Shop the collection</a><a class="nm-btn nm-ghost" href="#about">How it's made</a></div></div><img class="nm-photo" src="${U('1685270066088-27bb10a18088', 1400)}" alt="Shelves of handmade vases and plates"></div></section>
<section class="nm-section nm-alt" id="shop"><div class="nm-wrap"><div class="nm-head"><h2>The collection</h2><p>Each piece varies a little. That's the glaze, not a fault.</p></div><div class="nm-filters"><a class="nm-filter" href="#shop" data-nm-filter>All</a><a class="nm-filter" href="#shop" data-nm-filter>Drinking</a><a class="nm-filter" href="#shop" data-nm-filter>Eating</a><a class="nm-filter" href="#shop" data-nm-filter>For the home</a></div><div class="nm-products">${[
    product('1740478949627-155c907b3ca0', 'Handmade stoneware cups on a table', 'Drinking', 'Everyday mug', 'Holds a proper 350ml, in a speckled oat glaze', '£24'),
    product('1612870199268-d33b7e0bd9b0', 'White ceramic mugs on a wooden shelf', 'Drinking', 'Tall mug', 'A taller shape for long coffees and tea with milk', '£26'),
    product('1642355779808-4285b3987239', 'A stack of white stoneware bowls', 'Eating', 'Breakfast bowl', 'Deep enough for cereal, porridge or noodles', '£22'),
    product('1740478949628-ff562c3c3923', 'A pile of white handmade plates', 'Eating', 'Dinner plate', '27cm across, with a raised rim that keeps sauce in', '£28'),
    product('1677761640321-b80251be00ca', 'Two small vases on a table', 'For the home', 'Bud vases, pair', 'For a single stem or a few sprigs from the garden', '£36'),
    product('1572725350945-a2d24faa89b0', 'A round white ceramic pot', 'For the home', 'Lidded pot', 'For sugar, salt or loose tea, with a snug lid', '£32', true)
  ].join('')}</div></div></section>
<section class="nm-section" id="about"><div class="nm-wrap nm-split"><img class="nm-photo" src="${U('1723717275425-eb4a16b5d2da', 1200)}" alt="A potter shaping clay on the wheel"><div><h2>Made in a small studio</h2><p>Every piece starts as a lump of clay on the wheel. It is trimmed, dried, fired twice and glazed by hand, which is why no two mugs are quite the same.</p><p>New pieces come out of the kiln every few weeks. When something sells out, it's usually back in the next firing.</p></div></div></section>
<section class="nm-section nm-alt" id="delivery"><div class="nm-wrap"><h2>Delivery and returns</h2><div class="nm-perks"><div class="nm-perk"><h3>Packed by hand</h3><p>Every order is wrapped in recycled paper and boxed to travel.</p></div><div class="nm-perk"><h3>Tracked delivery</h3><p>Sent tracked anywhere in the UK, so you always know where it is.</p></div><div class="nm-perk"><h3>Returns within 14 days</h3><p>Changed your mind? Send it back unused within 14 days of delivery.</p></div></div></div></section>
<footer class="nm-foot"><div class="nm-wrap nm-foot-in"><span>Holloway Clay</span><span>Questions about an order? <a href="mailto:">Email the studio</a></span><span>Photos from Unsplash</span></div></footer>`,
  css: THEME_CSS + '\n' + SHOP_CSS
};
