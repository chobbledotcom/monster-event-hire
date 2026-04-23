// Monster Event Hire - site scripts (vanilla JS, no jQuery)

document.addEventListener("DOMContentLoaded", () => {
  initInfinityNumber();
  initMobileMenu();
  initSearch();
  initEnquiryForm();
  initInputFocus();
  initSocialShare();
  initProductLinks();
  initProductGallery();
  initLazyBgImages();
  initScrollToEl();
  initProductNameFill();
  initScrollTop();
  initFixedHeader();
});

window.addEventListener(
  "resize",
  () => {
    if (window.innerWidth > 1100) document.body.classList.remove("no-overflow");
  },
  { passive: true },
);

// Call-tracking phone numbers: suppress link styling on narrow screens
function initInfinityNumber() {
  if (window.innerWidth < 1100) {
    for (const el of document.querySelectorAll(".InfinityNumber15214")) {
      el.classList.add("clickable");
    }
  }
}

// Mobile menu
function initMobileMenu() {
  const headerMenu = document.querySelector(".header-menu");

  document.querySelector(".nav-trigger")?.addEventListener("click", () => {
    headerMenu?.classList.add("shown");
    document.body.classList.add("no-overflow");
  });

  document.querySelector("header .close-icon")?.addEventListener("click", () => {
    headerMenu?.classList.remove("shown");
    document.body.classList.remove("no-overflow");
  });

  for (const item of document.querySelectorAll("header nav .has-children")) {
    const trigger = item.querySelector(".sub-menu-trigger");
    trigger?.addEventListener("click", () => {
      trigger.classList.toggle("shown");
      item.querySelector("ul")?.classList.toggle("shown");
    });
  }

  if (window.innerWidth < 1100) {
    for (const item of document.querySelectorAll(".disable-link-on-mobiles")) {
      const link = item.querySelector("a");
      const subTrigger = item.querySelector(".sub-menu-trigger");
      link?.addEventListener("click", (e) => {
        e.preventDefault();
        subTrigger?.click();
      });
    }
  }

  const legalsMenu = document.querySelector(".menu-legals");
  if (legalsMenu) {
    legalsMenu.querySelector("h6")?.addEventListener("click", () => {
      legalsMenu.querySelector("nav")?.classList.add("shown");
      document.body.classList.add("no-overflow");
    });
    legalsMenu.querySelector(".close-icon")?.addEventListener("click", () => {
      legalsMenu.querySelector("nav")?.classList.remove("shown");
      document.body.classList.remove("no-overflow");
    });
  }
}

// Search form toggle
function initSearch() {
  const searchForm = document.querySelector(".searchform");

  document.querySelector(".searchtrigger")?.addEventListener("click", () => {
    const nowShown = searchForm?.classList.toggle("shown");
    if (nowShown) setTimeout(() => document.querySelector("#search")?.focus(), 25);
  });

  document.querySelector(".search-close")?.addEventListener("click", () => {
    searchForm?.classList.remove("shown");
  });

  window.addEventListener(
    "scroll",
    () => searchForm?.classList.remove("shown"),
    { passive: true },
  );
}

// Enquiry form overlay
function initEnquiryForm() {
  const form = document.querySelector(".the_enquiry_form");
  const scrollTop = document.querySelector(".scroll-top");

  for (const btn of document.querySelectorAll(".enquiry-button")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.add("no-overflow");
      form?.classList.add("shown");
      if (scrollTop) scrollTop.style.display = "none";
    });
  }

  const handleClose = () => {
    form?.classList.remove("shown");
    document.body.classList.remove("no-overflow");
    document.querySelector("header")?.classList.remove("small");
    if (scrollTop) scrollTop.style.display = "";
    updateScrollTop();
  };

  for (const el of document.querySelectorAll(".close-enquiry-form, .form-bg")) {
    el.addEventListener("click", handleClose);
  }
}

// Input focus styles (adds/removes .focus on the wrapping .field_wrap)
function initInputFocus() {
  for (const input of document.querySelectorAll("input, textarea")) {
    const wrap = input.closest(".field_wrap");
    if (!wrap) continue;
    input.addEventListener("focus", () => wrap.classList.add("focus"));
    input.addEventListener("blur", () => wrap.classList.remove("focus"));
  }
}

// Social share links open in a popup window
function initSocialShare() {
  for (const link of document.querySelectorAll(".social-share a")) {
    if (link.closest("li.email")) continue;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(link.href.replace(/\/$/, ""), link.id || "_blank", "height=600,width=800");
    });
  }
}

// Make entire .product card navigate to its inner link
function initProductLinks() {
  for (const product of document.querySelectorAll(".product:not(.enquire)")) {
    product.addEventListener("click", () => {
      const href = product.querySelector("a")?.href;
      if (href) window.location = href;
    });
  }
}

// Swap the main display to show item i. The chobble-template {% image %}
// shortcode wraps images in <picture> inside .image-wrapper divs; updating
// img.src alone is ignored because <source> srcsets take precedence, so we
// replace the whole .image-wrapper innerHTML (with a fallback for pages
// without the wrapper).
function swapMainImage(items, snap, i) {
  const mainWrapper = items[0].querySelector(".image-wrapper");
  if (mainWrapper && snap.wrapperContents[i]) {
    mainWrapper.style.cssText = snap.wrapperStyles[i];
    mainWrapper.innerHTML = snap.wrapperContents[i];
    mainWrapper.querySelector("img")?.removeAttribute("loading");
    return;
  }
  const mainImg = items[0].querySelector("img");
  if (mainImg) {
    mainImg.src = snap.sources[i].src;
    mainImg.alt = snap.sources[i].alt;
  }
}

const NEIGHBOR_REVEAL_RATIO = 0.5;

function getNeighborOffset(thumb, stripRect) {
  const next = thumb.nextElementSibling;
  if (next) {
    const nextRect = next.getBoundingClientRect();
    const visible = Math.max(0, stripRect.right - nextRect.left);
    const target = next.offsetWidth * NEIGHBOR_REVEAL_RATIO;
    if (visible < target) return target - visible;
  }

  const prev = thumb.previousElementSibling;
  if (prev) {
    const prevRect = prev.getBoundingClientRect();
    const visible = Math.max(0, prevRect.right - stripRect.left);
    const target = prev.offsetWidth * NEIGHBOR_REVEAL_RATIO;
    if (visible < target) return -(target - visible);
  }

  return 0;
}

function getScrollOffset(thumb, strip) {
  const thumbRect = thumb.getBoundingClientRect();
  const stripRect = strip.getBoundingClientRect();
  const fullyVisible =
    thumbRect.left >= stripRect.left && thumbRect.right <= stripRect.right;

  if (fullyVisible) return getNeighborOffset(thumb, stripRect);

  const kids = strip.children;
  const isEdge = thumb === kids[0] || thumb === kids[kids.length - 1];
  const extra = isEdge ? 0 : thumb.offsetWidth / 2;
  return thumbRect.left < stripRect.left
    ? thumbRect.left - stripRect.left - extra
    : thumbRect.right - stripRect.right + extra;
}

function scrollThumbnailIntoView(thumb, strip) {
  if (!thumb || !strip) return;
  const offset = getScrollOffset(thumb, strip);
  if (!offset) return;
  strip.scrollBy({ left: offset, behavior: "smooth" });
}

function buildThumbStrip(items, snap, onSelect) {
  const strip = document.createElement("div");
  strip.className = "gallery-thumbs";
  for (const [i, item] of items.entries()) {
    const thumb = document.createElement("img");
    thumb.src = item.dataset.thumb || snap.sources[i].src;
    thumb.alt = "";
    if (i === 0) thumb.classList.add("active");
    thumb.addEventListener("click", () => onSelect(i));
    strip.appendChild(thumb);
  }
  return strip;
}

function buildArrowButton(cls, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", onClick);
  return btn;
}

// Product image gallery (replaces jQuery lightSlider)
function initProductGallery() {
  for (const gallery of document.querySelectorAll(".product-gallery")) {
    const items = [...gallery.querySelectorAll("ul li")];
    if (items.length <= 1) continue;

    // Snapshot content before any DOM mutation so clicking back to thumb 0 works.
    const snap = {
      wrapperContents: items.map(
        (item) => item.querySelector(".image-wrapper")?.innerHTML ?? "",
      ),
      wrapperStyles: items.map(
        (item) => item.querySelector(".image-wrapper")?.style.cssText ?? "",
      ),
      sources: items.map((item) => ({
        src: item.querySelector("img")?.src || item.dataset.thumb || "",
        alt: item.querySelector("img")?.alt || "",
      })),
    };

    items[0].classList.add("gallery-main");
    // First image is the LCP candidate; don't let the shortcode's lazy-load defer it.
    items[0].querySelector("img")?.removeAttribute("loading");
    for (let i = 1; i < items.length; i++) items[i].style.display = "none";

    let current = 0;
    let thumbStrip;
    let prevBtn;
    let nextBtn;

    const selectImage = (i) => {
      if (i < 0 || i >= items.length || i === current) return;
      current = i;
      swapMainImage(items, snap, i);
      const thumbs = [...thumbStrip.querySelectorAll("img")];
      for (const [ti, t] of thumbs.entries()) {
        t.classList.toggle("active", ti === i);
      }
      prevBtn.classList.toggle("disabled", i === 0);
      nextBtn.classList.toggle("disabled", i === items.length - 1);
      scrollThumbnailIntoView(thumbs[i], thumbStrip);
    };

    thumbStrip = buildThumbStrip(items, snap, selectImage);
    prevBtn = buildArrowButton("lSPrev", "Previous image", () =>
      selectImage(current - 1),
    );
    nextBtn = buildArrowButton("lSNext", "Next image", () =>
      selectImage(current + 1),
    );
    prevBtn.classList.add("disabled");

    gallery.appendChild(thumbStrip);
    gallery.appendChild(prevBtn);
    gallery.appendChild(nextBtn);
    gallery.querySelector("ul")?.classList.remove("cS-hidden");
  }
}

// Lazy-load product background images via IntersectionObserver
function initLazyBgImages() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const src = el.dataset.img;
        if (src) {
          el.style.backgroundImage = `url(${src})`;
          el.classList.add("loaded");
        }
        observer.unobserve(el);
      }
    },
    { rootMargin: "0px 0px 200px 0px" },
  );

  for (const el of document.querySelectorAll(".product[data-img]")) {
    observer.observe(el);
  }
}

// Smooth-scroll anchor buttons (.scroll-to-el with data-scroll="#target")
function initScrollToEl() {
  for (const el of document.querySelectorAll(".scroll-to-el")) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(el.dataset.scroll);
      if (target) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - 150,
          behavior: "smooth",
        });
      }
    });
  }
}

// Pre-fill the hidden product name field in the enquiry form
function initProductNameFill() {
  const name = document.querySelector(".product-name")?.textContent?.trim();
  const input = document.querySelector('input[name="your-product"]');
  if (name && input) input.value = name;
}

// Scroll-to-top button
function initScrollTop() {
  const btn = document.querySelector(".scroll-top");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const target = document.querySelector("#site-wrap");
    window.scrollTo({
      top: target ? target.offsetTop - 50 : 0,
      behavior: "smooth",
    });
  });

  window.addEventListener("scroll", updateScrollTop, { passive: true });
  updateScrollTop();
}

function updateScrollTop() {
  const btn = document.querySelector(".scroll-top");
  if (!btn) return;
  const halfway = (document.documentElement.scrollHeight - window.innerHeight) * 0.5;
  btn.style.display = window.scrollY >= halfway ? "" : "none";
}

// Fixed (shrinking) header on scroll
function initFixedHeader() {
  window.addEventListener("scroll", handleFixedHeader, { passive: true });
}

function handleFixedHeader() {
  const threshold = (document.documentElement.scrollHeight - window.innerHeight) * 0.01;
  document.querySelector("header")?.classList.toggle("small", window.scrollY >= threshold);
}
