/* Where things are in the Studio: the screens, how they group in the menu,
   what each top bar calls itself and where its back button goes. */

export const NAV = [
  { href: "/", label: "Dashboard", icon: "home", desc: "Today at a glance" },
  { href: "/leads", label: "Leads", icon: "leads", need: "leads.read", desc: "Enquiries and discovery forms" },
  { href: "/posts", label: "Posts", icon: "posts", need: "content.read", desc: "Write and schedule the blog" },
  { href: "/media", label: "Media", icon: "media", need: "media.read", desc: "Photos and videos" },
  { href: "/pages", label: "Pages", icon: "pages", need: "content.read", desc: "Edit the website's pages" },
  { href: "/brand", label: "Brand", icon: "brand", need: "content.read", desc: "Logo, colours and contact" },
  { href: "/seo", label: "SEO", icon: "seo", need: "content.read", desc: "Titles, redirects, sitemap" },
  { href: "/users", label: "Team", icon: "users", desc: "Who can sign in" },
  { href: "/account", label: "Account", icon: "account", desc: "Your profile and LinkedIn" },
];

/* A client's own screens. Staff see them under that client's name in the
   sidebar; a client login sees only these. */
export const CLIENT_NAV = {
  "dipti-enterprise": [
    { href: "/dipti", label: "Overview", icon: "home", exact: true, desc: "The site at a glance" },
    { href: "/dipti/products", label: "Products", icon: "chair", desc: "Furniture on the site" },
    { href: "/dipti/categories", label: "Categories", icon: "tag", desc: "How products group" },
    { href: "/dipti/gallery", label: "Gallery", icon: "photo", desc: "Project photos" },
    { href: "/dipti/reviews", label: "Reviews", icon: "star", desc: "What customers say" },
    { href: "/dipti/settings", label: "Site details", icon: "settings", desc: "Contact, hours, address" },
  ],
};

/* the order screens earn a place in the phone's bottom bar */
export const TAB_ORDER = ["/", "/posts", "/leads", "/media", "/pages"];

const CLIENT_NAV_EXACT = new Set(Object.values(CLIENT_NAV).flatMap((g) => g.filter((n) => n.exact).map((n) => n.href)));

export function isOn(path, href) {
  return href === "/" ? path === "/" : CLIENT_NAV_EXACT.has(href) ? path === href : path === href || path.startsWith(href + "/");
}

/* screens below a section, named for the top bar */
const DEEP = [
  [/^\/posts\/[^/]+$/, "Post"],
  [/^\/pages\/home$/, "Home page"],
  [/^\/pages\/[^/]+$/, "Page"],
  [/^\/dipti\/products\/[^/]+$/, "Product"],
];

const ALL = NAV.concat(Object.values(CLIENT_NAV).flat());

/* { title, top }: top is true on a screen the menu links to directly */
export function screenFor(path) {
  const top = ALL.find((n) => n.href === path);
  if (top) return { title: top.label, top: true };
  const deep = DEEP.find(([re]) => re.test(path));
  if (deep) return { title: deep[1], top: false };
  const near = ALL.filter((n) => n.href !== "/" && path.startsWith(n.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return { title: near ? near.label : "Studio", top: false };
}

/* "/posts/abc" → "/posts" */
export function parentOf(path) {
  const up = path.replace(/\/[^/]+\/?$/, "");
  return up || "/";
}
