// Chart colors, kept out of the client chart module so server components can read the values.
// Validated pair (dataviz palette check, light surface): periwinkle from the brand ramp, then
// coral. Graphite reads as gray in a chart, so it's kept for text.
export const SERIES_COLORS = ["#5260cc", "#eb6834"] as const;
