/**
 * Founders. Edit this list to change the portrait, bio, and links.
 * Leave photo as "" to keep the initials monogram.
 * Email is stored as separate user and domain parts and assembled
 * only when the Email button is used.
 */
export const FOUNDERS = [
  {
    name: "Ryan Phua",
    title: "Founder",
    initials: "RP",
    photo: "",
    bio: "Early career software engineer specialising in cloud migration of CI/CD automation. Led end-to-end migration of SaaS delivery stack from AWS Amplify V1 to V2, built an air-gapped Kubernetes cluster customised for on-satellite ML workloads for image segmentation tasks in Pytorch & Tensorflow. Anubys is my portfolio product aimed at delivering scalable, cost-efficient & effective AI model infrastructure to guarantee accountable, reproducible, and retraceable ML workflows for enterprise-scale tooling and/or individual hobbyists.",
    github: "https://github.com/ryean0",
    emailUser: "ryanphua.dev",
    emailDomain: "outlook.com",
  },
];

const MAIL_ICON = `<svg class="founder-mail-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="6" width="17" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7.2 12 13l8-5.8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function founderMailto(person) {
  return `mailto:${person.emailUser}@${person.emailDomain}`;
}

export function renderFounderCard(person, index) {
  const avatar = person.photo
    ? `<img class="founder-avatar" src="${escapeHtml(person.photo)}" alt="">`
    : `<span class="founder-avatar" aria-hidden="true">${escapeHtml(person.initials)}</span>`;
  return `<li class="founder-card">${avatar}<div class="founder-copy"><h3 class="founder-name">${escapeHtml(person.name)}</h3><p class="founder-role">${escapeHtml(person.title)}</p><p class="founder-bio">${escapeHtml(person.bio)}</p><p class="founder-links"><a href="${escapeHtml(person.github)}" rel="noopener noreferrer">GitHub</a><button type="button" class="founder-mail" data-founder-email="${index}">${MAIL_ICON}<span>Email</span></button></p></div></li>`;
}

export function renderFoundersHtml(people = FOUNDERS) {
  return people.map((person, index) => renderFounderCard(person, index)).join("");
}

export function bindFounderEmails(root = document) {
  for (const button of root.querySelectorAll("[data-founder-email]")) {
    button.addEventListener("click", () => {
      const person = FOUNDERS[Number(button.getAttribute("data-founder-email"))];
      if (!person) return;
      window.location.href = founderMailto(person);
    });
  }
}
