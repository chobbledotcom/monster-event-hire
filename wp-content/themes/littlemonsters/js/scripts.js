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

// Product image gallery (replaces jQuery lightSlider)
function initProductGallery() {
  for (const gallery of document.querySelectorAll(".product-gallery")) {
    const items = [...gallery.querySelectorAll("ul li")];
    if (items.length <= 1) continue;

    // Snapshot content before any DOM mutation so clicking back to thumb 0 works.
    // The chobble-template wraps images in <picture> inside .image-wrapper divs;
    // updating img.src alone is ignored because <source> srcsets take precedence.
    // We must swap the entire .image-wrapper innerHTML + background on click.
    const wrapperContents = items.map(
      (item) => item.querySelector(".image-wrapper")?.innerHTML ?? "",
    );
    const wrapperStyles = items.map(
      (item) => item.querySelector(".image-wrapper")?.style.cssText ?? "",
    );
    // Fallback src/alt for pages that don't use .image-wrapper
    const sources = items.map((item) => ({
      src: item.querySelector("img")?.src || item.dataset.thumb || "",
      alt: item.querySelector("img")?.alt || "",
    }));

    // First item is always the main display area; hide the rest
    items[0].classList.add("gallery-main");
    for (let i = 1; i < items.length; i++) {
      items[i].style.display = "none";
    }

    const thumbStrip = document.createElement("div");
    thumbStrip.className = "gallery-thumbs";

    for (const [i, item] of items.entries()) {
      const thumb = document.createElement("img");
      thumb.src = item.dataset.thumb || sources[i].src;
      thumb.alt = "";
      if (i === 0) thumb.classList.add("active");

      thumb.addEventListener("click", () => {
        const mainWrapper = items[0].querySelector(".image-wrapper");
        if (mainWrapper && wrapperContents[i]) {
          mainWrapper.style.cssText = wrapperStyles[i];
          mainWrapper.innerHTML = wrapperContents[i];
          // Ensure the newly inserted lazy image loads immediately
          mainWrapper.querySelector("img")?.removeAttribute("loading");
        } else {
          const mainImg = items[0].querySelector("img");
          if (mainImg) {
            mainImg.src = sources[i].src;
            mainImg.alt = sources[i].alt;
          }
        }
        for (const [ti, t] of [...thumbStrip.querySelectorAll("img")].entries()) {
          t.classList.toggle("active", ti === i);
        }
      });

      thumbStrip.appendChild(thumb);
    }

    gallery.appendChild(thumbStrip);
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
