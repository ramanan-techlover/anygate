<script lang="ts">
  import type { HeatDay } from '../../api/analytics';

  interface Props {
    days: HeatDay[];
  }
  let { days }: Props = $props();

  // Build week columns (7 rows), padded so the first column starts on Sunday.
  const weeks = $derived.by(() => {
    if (days.length === 0) return [];
    const first = new Date(days[0].date + 'T00:00:00');
    const lead = first.getDay();
    const padded: (HeatDay | null)[] = [...Array(lead).fill(null), ...days];
    const cols: (HeatDay | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  });

  // Month labels: scan days directly so every month present in data gets a label;
  // convert day index to column.
  const monthMarks = $derived.by(() => {
    const marks: { col: number; label: string }[] = [];
    let lastMonth = -1;
    days.forEach((d, idx) => {
      const adj = idx + (weeks.length ? new Date(days[0].date + 'T00:00:00').getDay() : 0);
      const col = Math.floor(adj / 7);
      const m = new Date(d.date + 'T00:00:00').getMonth();
      if (m !== lastMonth) {
        marks.push({ col, label: new Date(d.date + 'T00:00:00').toLocaleString('en', { month: 'short' }) });
        lastMonth = m;
      }
    });
    return marks;
  });

  // Format a token count compactly (e.g. 1.2M) for tooltips.
  const fmtTokens = (n: number): string => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  };

  // 5-stop accent gradient: each level is clearly lighter/darker than its
  // neighbor so differences in daily token volume read at a glance.
  const levelColor = (lvl: number): string => {
    switch (lvl) {
      case 0:
        return 'transparent';
      case 1:
        return 'color-mix(in srgb, var(--accent) 22%, transparent)';
      case 2:
        return 'color-mix(in srgb, var(--accent) 45%, transparent)';
      case 3:
        return 'color-mix(in srgb, var(--accent) 70%, transparent)';
      default:
        return 'var(--accent)';
    }
  };
</script>

<div class="heat">
  <div class="months">
    {#each weeks as _, ci (ci)}
      {@const mark = monthMarks.find((m) => m.col === ci)}
      <span class="month" class:has={!!mark}>{mark ? mark.label : ''}</span>
    {/each}
  </div>
  <div class="weeks">
    {#each weeks as col, ci (ci)}
      <div class="col">
        {#each col as d, ri (ri)}
          {#if d}
            <div
              class="cell"
              style="background:{levelColor(d.intensity)}"
              title={`${d.date} · ${fmtTokens(d.count)} tokens`}
            ></div>
          {:else}
            <div class="cell empty"></div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
  <div class="legend">
    <span>Less</span>
    {#each [0, 1, 2, 3, 4] as l (l)}
      <span class="key" style="background:{levelColor(l)}"></span>
    {/each}
    <span>More</span>
  </div>
</div>

<style>
  .heat {
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .months {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
    min-width: max-content;
  }
  .month {
    font-size: 10.5px;
    color: var(--text-3);
    flex: 0 0 13px;
    width: 13px;
    line-height: 1;
    white-space: nowrap;
    overflow: visible;
  }
  .month:not(.has) {
    visibility: hidden;
  }

  .weeks {
    display: flex;
    gap: 4px;
    min-width: max-content;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cell {
    width: 13px;
    height: 13px;
    border-radius: 3px;
    border: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
    transition: transform var(--dur-xs) var(--ease);
  }
  .cell:not(.empty) {
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .cell:not(.empty):hover {
    transform: scale(1.18);
    border-color: var(--border-bright);
  }
  .cell.empty {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    font-size: 11.5px;
    color: var(--text-3);
  }
  .key {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid var(--border);
  }
</style>
