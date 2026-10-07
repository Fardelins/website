import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Only the pieces the dashboard actually draws, importing `echarts` whole would pull
// every chart type and roughly quadruple what ships.
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

// ngx-echarts destructures `init` straight off whatever this dynamic import resolves
// to (`load().then(({ init }) => init(dom, ...))`), a default export only puts it at
// `.default`, so `init` comes back undefined and the throw is swallowed inside a promise
// chain nothing awaits. Re-exporting the named exports is what it actually expects.
export * from 'echarts/core';
