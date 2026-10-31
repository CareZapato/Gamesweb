import { deadholdBuildStats, type OwnedUpgrades } from '@arena/shared';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const deadholdBuildPanelHtml = (owned: OwnedUpgrades): string => {
  const rows = deadholdBuildStats(owned)
    .map((l) => `<tr><td>${esc(l.label)}</td><td><b>${esc(l.value)}</b></td></tr>`)
    .join('');
  return `<div class="dh-build-panel"><h3>Tu build (supervivencia)</h3><table class="dh-build-table">${rows}</table></div>`;
};
