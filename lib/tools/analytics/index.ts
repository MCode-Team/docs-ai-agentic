import { queryAggregateTool } from "./query-aggregate";
import { trendReportTool } from "./trend-report";
import { cohortReportTool } from "./cohort-report";
import { oosReportTool } from "./oos-report";
import { exportExcelArtifactTool } from "./export-excel-artifact";
import { reportComposerTools } from "./report-composer";
import { dataQualityReportTool } from "./data-quality-report";

export {
  queryAggregateTool,
  trendReportTool,
  cohortReportTool,
  oosReportTool,
  exportExcelArtifactTool,
  reportComposerTools,
  dataQualityReportTool,
};

export const analyticsTools = {
  queryAggregate: queryAggregateTool,
  trendReport: trendReportTool,
  cohortReport: cohortReportTool,
  oosReport: oosReportTool,
  exportExcelArtifact: exportExcelArtifactTool,
  dataQualityReport: dataQualityReportTool,
  ...reportComposerTools,
};
