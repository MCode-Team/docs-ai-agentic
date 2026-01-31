import { queryAggregateTool } from "./query-aggregate";
import { trendReportTool } from "./trend-report";
import { cohortReportTool } from "./cohort-report";
import { oosReportTool } from "./oos-report";
import { exportExcelArtifactTool } from "./export-excel-artifact";

export { queryAggregateTool, trendReportTool, cohortReportTool, oosReportTool, exportExcelArtifactTool };

export const analyticsTools = {
  queryAggregate: queryAggregateTool,
  trendReport: trendReportTool,
  cohortReport: cohortReportTool,
  oosReport: oosReportTool,
  exportExcelArtifact: exportExcelArtifactTool,
};
