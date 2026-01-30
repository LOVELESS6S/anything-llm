import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Timeline } from "vis-timeline/standalone";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import { 
  CaretDown, 
  Clock, 
  Anchor, 
  BookOpen,
  ArrowsOutSimple,
  ArrowsInSimple,
  FunnelSimple,
  BookOpenText,
} from "@phosphor-icons/react";
import { getBaseFile } from "@/components/Modals/ManageWorkspace/Documents/WorkspaceDirectory/WorkspaceFileRow";
import { openDocumentViewer } from "@/components/DocumentViewerModal";

// Custom CSS to style vis-timeline - using POINT markers for density
const TIMELINE_STYLES = `
  .historical-timeline-container {
    --primary-color: #F59E0B;
    --secondary-color: #64748b;
  }

  .historical-timeline-container .vis-timeline {
    border: none;
    font-family: inherit;
    background: transparent;
  }

  .historical-timeline-container .vis-panel.vis-center,
  .historical-timeline-container .vis-panel.vis-left,
  .historical-timeline-container .vis-panel.vis-right,
  .historical-timeline-container .vis-panel.vis-top,
  .historical-timeline-container .vis-panel.vis-bottom {
    border: none;
  }

  /* Group labels on the left */
  .historical-timeline-container .vis-labelset .vis-label {
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.6);
    font-size: 9px;
    font-weight: 600;
    padding: 6px 10px;
    min-width: 100px;
  }

  .historical-timeline-container .vis-labelset .vis-label.primary-group {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0.2) 100%);
    color: var(--primary-color);
    border-left: 2px solid var(--primary-color);
  }

  .historical-timeline-container .vis-labelset .vis-label.secondary-group {
    background: linear-gradient(90deg, rgba(100, 116, 139, 0.1) 0%, rgba(0,0,0,0.2) 100%);
    color: var(--secondary-color);
    border-left: 2px solid var(--secondary-color);
  }

  /* Group rows */
  .historical-timeline-container .vis-foreground .vis-group {
    border-bottom: 1px solid rgba(255,255,255,0.05);
    min-height: 50px;
  }

  .historical-timeline-container .vis-foreground .vis-group.primary-group {
    background: rgba(245, 158, 11, 0.02);
  }

  .historical-timeline-container .vis-foreground .vis-group.secondary-group {
    background: rgba(100, 116, 139, 0.02);
  }

  /* POINT type items - small dots that expand on hover */
  .historical-timeline-container .vis-item.vis-point {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .historical-timeline-container .vis-item.vis-point .vis-item-content {
    padding: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .historical-timeline-container .vis-item.vis-point .vis-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid;
    transition: all 0.15s ease;
    cursor: pointer;
  }

  .historical-timeline-container .vis-item.primary-item .vis-dot {
    background: var(--primary-color);
    border-color: #b45309;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  }

  .historical-timeline-container .vis-item.secondary-item .vis-dot {
    background: var(--secondary-color);
    border-color: #475569;
    box-shadow: 0 0 4px rgba(100, 116, 139, 0.3);
  }

  /* Hover state - show label */
  .historical-timeline-container .vis-item.vis-point:hover .vis-dot {
    transform: scale(1.4);
    z-index: 1000;
  }

  .historical-timeline-container .vis-item.vis-point .vis-item-label {
    display: none;
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0,0,0,0.9);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    z-index: 1001;
  }

  .historical-timeline-container .vis-item.vis-point:hover .vis-item-label {
    display: block;
  }

  /* Selected state */
  .historical-timeline-container .vis-item.vis-selected .vis-dot {
    transform: scale(1.5);
    box-shadow: 0 0 0 3px #46c8ff, 0 0 12px rgba(70, 200, 255, 0.6);
  }

  /* Time axis styling */
  .historical-timeline-container .vis-time-axis .vis-text {
    color: rgba(255,255,255,0.6);
    font-size: 11px;
    font-weight: 500;
  }

  .historical-timeline-container .vis-time-axis .vis-text.vis-major {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  .historical-timeline-container .vis-time-axis .vis-grid.vis-minor {
    border-color: rgba(255,255,255,0.05);
  }

  .historical-timeline-container .vis-time-axis .vis-grid.vis-major {
    border-color: rgba(255,255,255,0.15);
  }

  /* Background */
  .historical-timeline-container .vis-panel.vis-center {
    background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 100%);
  }

  /* Cluster styling - for grouped items */
  .historical-timeline-container .vis-item.vis-cluster {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 2px 8px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4) !important;
    cursor: pointer;
  }

  .historical-timeline-container .vis-item.vis-cluster:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6) !important;
  }
`;

const DEFAULT_HEIGHT = 160;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 400;

/**
 * HistoricalTimeline - Uses vis-timeline with POINT markers for clean display
 * Features: Year filtering, clustering, point markers
 */
export default function HistoricalTimeline({ workspace }) {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [baseFileDocPath, setBaseFileDocPath] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null); // null = all years
  const [clusterItems, setClusterItems] = useState(null); // Items in clicked cluster

  // Listen for base file changes
  useEffect(() => {
    const updateBaseFile = () => {
      setBaseFileDocPath(getBaseFile(workspace?.id));
    };
    updateBaseFile();
    window.addEventListener("base_file_changed", updateBaseFile);
    return () => window.removeEventListener("base_file_changed", updateBaseFile);
  }, [workspace?.id]);

  // Parse documents into timeline format
  const { allItems, years, stats, groups, docMap } = useMemo(() => {
    if (!workspace?.documents || workspace.documents.length === 0) {
      return { allItems: [], years: [], stats: { total: 0, primary: 0, secondary: 0 }, groups: [], docMap: {} };
    }

    const timelineItems = [];
    const yearsSet = new Set();
    const documentMap = {}; // Store document info for viewer
    let itemId = 1;
    let primaryCount = 0;
    let secondaryCount = 0;

    workspace.documents.forEach((doc) => {
      try {
        const metadata = typeof doc.metadata === "string" 
          ? JSON.parse(doc.metadata) 
          : doc.metadata;

        if (metadata?.historical_metadata?.temporal_points) {
          const docTitle = doc.filename || metadata?.title || "Unknown";
          const docPath = doc.docpath || `${doc.folderName}/${doc.name}`;
          const isBaseFile = baseFileDocPath && docPath === baseFileDocPath;
          const isDiaryFile = docTitle.toLowerCase().includes("diary");
          const isPrimary = isBaseFile || (!baseFileDocPath && isDiaryFile);

          // Store document info for the viewer - including PDF filename if available
          if (!documentMap[docPath]) {
            documentMap[docPath] = {
              title: docTitle,
              chunks: [], // Will be populated if we have chunk data
              metadata: metadata,
              // Extract original PDF filename from document metadata
              originalPdfFilename: metadata?.originalPdfFilename || null,
              totalPages: metadata?.totalPages || null,
            };
          }

          metadata.historical_metadata.temporal_points.forEach((point) => {
            if (point.date && point.summary) {
              const date = new Date(point.date);
              const year = date.getFullYear();
              yearsSet.add(year);
              
              if (isPrimary) primaryCount++;
              else secondaryCount++;

              // Extract page number if available
              const pageNumber = point.page_number || point.pageNumber || point.page || null;

              timelineItems.push({
                id: itemId++,
                group: isPrimary ? "primary" : "secondary",
                content: "", // Empty for point type - we use dot
                start: date,
                type: "point",
                title: `${formatDateShort(date)}: ${point.summary}`,
                className: isPrimary ? "primary-item" : "secondary-item",
                year: year,
                // Store extra data
                _source: docTitle,
                _docPath: docPath,
                _fullSummary: point.summary,
                _isPrimary: isPrimary,
                _date: point.date,
                _pageNumber: pageNumber,
                _position: point.position || null,
                // Store PDF info for viewer
                _originalPdfFilename: metadata?.originalPdfFilename || null,
                _totalPages: metadata?.totalPages || null,
              });
            }
          });
        }
      } catch (e) {
        console.debug(`[Timeline] Could not parse metadata:`, e.message);
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);

    // Build groups - only include groups that have items
    const timelineGroups = [];
    if (primaryCount > 0) {
      timelineGroups.push({ 
        id: "primary", 
        content: `⚓ Primary (${primaryCount})`,
        className: "primary-group",
        order: 1,
      });
    }
    if (secondaryCount > 0) {
      timelineGroups.push({ 
        id: "secondary", 
        content: `📚 References (${secondaryCount})`,
        className: "secondary-group",
        order: 2,
      });
    }

    return { 
      allItems: timelineItems, 
      years: sortedYears,
      stats: { total: timelineItems.length, primary: primaryCount, secondary: secondaryCount },
      groups: timelineGroups,
      docMap: documentMap,
    };
  }, [workspace?.documents, baseFileDocPath]);

  // Filter items by selected year
  const filteredItems = useMemo(() => {
    if (!selectedYear) return allItems;
    return allItems.filter(item => item.year === selectedYear);
  }, [allItems, selectedYear]);

  // Initialize vis-timeline
  useEffect(() => {
    if (!containerRef.current || filteredItems.length === 0) {
      setHasData(allItems.length > 0);
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
      return;
    }

    setHasData(true);
    console.log("[Timeline] Initializing with", filteredItems.length, "items");

    // Destroy existing timeline if any
    if (timelineRef.current) {
      timelineRef.current.destroy();
      timelineRef.current = null;
    }

    // Calculate date range with padding
    const dates = filteredItems.map(item => item.start.getTime());
    const minTime = Math.min(...dates);
    const maxTime = Math.max(...dates);
    const range = maxTime - minTime || (365 * 24 * 60 * 60 * 1000);
    const padding = range * 0.1; // 10% padding
    const minDate = new Date(minTime - padding);
    const maxDate = new Date(maxTime + padding);

    // Filter groups to only include those with items in filtered set
    const activeGroupIds = new Set(filteredItems.map(item => item.group));
    const activeGroups = groups.filter(g => activeGroupIds.has(g.id));

    // Timeline options - optimized for density
    const options = {
      start: minDate,
      end: maxDate,
      height: "100%",
      
      // Use point type for minimal visual footprint
      type: "point",
      
      // Margins
      margin: { 
        item: { horizontal: 0, vertical: 8 },
        axis: 30,
      },
      
      // Stacking with more vertical spread
      stack: true,
      stackSubgroups: false,
      
      // Clustering - only cluster items on the SAME DAY
      cluster: {
        maxItems: 3, // Only cluster when 3+ items overlap
        titleTemplate: "{count} events",
        showStipes: true,
        clusterCriteria: (firstItem, secondItem) => {
          // Only cluster items on the exact same day
          const d1 = firstItem.start;
          const d2 = secondItem.start;
          return d1.getDate() === d2.getDate() &&
                 d1.getMonth() === d2.getMonth() &&
                 d1.getFullYear() === d2.getFullYear();
        },
      },
      
      // Zoom settings - allow zooming in to 1 day
      zoomMin: 1000 * 60 * 60 * 24 * 1, // 1 day minimum
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 100, // 100 years
      zoomable: true,
      moveable: true,
      
      // Interaction
      selectable: true,
      multiselect: false,
      
      // Orientation - axis at bottom
      orientation: { axis: "bottom", item: "top" },
      
      // Tooltips
      tooltip: {
        followMouse: true,
        overflowMethod: "cap",
        delay: 100,
      },
      
      showCurrentTime: false,
      showMajorLabels: true,
      showMinorLabels: true,
    };

    try {
      const timeline = new Timeline(containerRef.current, filteredItems, activeGroups, options);
      timelineRef.current = timeline;
      
      // Fit after a short delay
      setTimeout(() => {
        timeline.fit({ animation: { duration: 300 } });
      }, 50);

      // Event handlers
      timeline.on("select", (properties) => {
        if (properties.items.length > 0) {
          const itemId = properties.items[0];
          // Handle cluster clicks - show all items on that day
          if (typeof itemId === "string" && itemId.startsWith("cluster")) {
            // Extract the date from the cluster ID or find via timeline
            try {
              // Get the cluster's time from the timeline
              const clusterProps = timeline.getEventProperties({ item: itemId });
              if (clusterProps && clusterProps.time) {
                const clusterDate = new Date(clusterProps.time);
                // Find all items on the same day
                const itemsOnDay = filteredItems.filter(item => {
                  const d = item.start;
                  return d.getDate() === clusterDate.getDate() &&
                         d.getMonth() === clusterDate.getMonth() &&
                         d.getFullYear() === clusterDate.getFullYear();
                }).sort((a, b) => a.start - b.start);
                
                if (itemsOnDay.length > 0) {
                  setClusterItems(itemsOnDay);
                  setSelectedItem(null);
                  return;
                }
              }
            } catch (e) {
              console.debug("[Timeline] Could not get cluster items:", e);
            }
            // Fallback: zoom in
            timeline.zoomIn(0.5, { animation: true });
            return;
          }
          const item = filteredItems.find(i => i.id === itemId);
          setSelectedItem(item);
          setClusterItems(null);
        } else {
          setSelectedItem(null);
          setClusterItems(null);
        }
      });
      
      // Handle click on clusters - detect by checking if item exists in our data
      timeline.on("click", (properties) => {
        console.log("[Timeline] Click:", properties);
        
        // If clicked on an item that's not in our filteredItems, it's likely a cluster
        if (properties.item !== null && properties.item !== undefined) {
          const isOurItem = filteredItems.some(i => i.id === properties.item);
          
          if (!isOurItem && properties.time) {
            // This is a cluster - find all items on this day
            const clickDate = new Date(properties.time);
            const itemsOnDay = filteredItems.filter(item => {
              const d = item.start;
              return d.getDate() === clickDate.getDate() &&
                     d.getMonth() === clickDate.getMonth() &&
                     d.getFullYear() === clickDate.getFullYear();
            }).sort((a, b) => a.start - b.start);
            
            console.log("[Timeline] Cluster clicked, found", itemsOnDay.length, "items on", clickDate);
            
            if (itemsOnDay.length > 0) {
              setClusterItems(itemsOnDay);
              setSelectedItem(null);
            }
          }
        }
      });

      timeline.on("doubleClick", (properties) => {
        if (properties.item) {
          const item = filteredItems.find(i => i.id === properties.item);
          if (item) {
            const itemDate = item.start.getTime();
            const zoomRange = 1000 * 60 * 60 * 24 * 14; // 2 weeks
            timeline.setWindow(itemDate - zoomRange, itemDate + zoomRange, { animation: true });
          }
        }
      });

    } catch (error) {
      console.error("[Timeline] Error creating timeline:", error);
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [filteredItems, allItems.length, groups]);

  // Resize handler
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Redraw timeline after resize
      if (timelineRef.current) {
        timelineRef.current.redraw();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [height]);

  // Timeline controls
  const handleZoomIn = () => timelineRef.current?.zoomIn(0.4, { animation: true });
  const handleZoomOut = () => timelineRef.current?.zoomOut(0.4, { animation: true });
  const handleFit = () => timelineRef.current?.fit({ animation: true });
  
  const handleMoveLeft = () => {
    const range = timelineRef.current?.getWindow();
    if (range) {
      const interval = (range.end - range.start) * 0.25;
      timelineRef.current.moveTo(new Date(range.start.getTime() - interval), { animation: true });
    }
  };
  
  const handleMoveRight = () => {
    const range = timelineRef.current?.getWindow();
    if (range) {
      const interval = (range.end - range.start) * 0.25;
      timelineRef.current.moveTo(new Date(range.end.getTime() + interval), { animation: true });
    }
  };

  // Jump to year
  const handleYearSelect = (year) => {
    setSelectedYear(year);
    setSelectedItem(null);
  };

  // Open document viewer for a timeline item (uses global event)
  const handleOpenDocument = useCallback((item) => {
    if (!item) return;
    
    const docInfo = docMap[item._docPath];
    
    // Get the PDF filename from item or docInfo
    const pdfFilename = item._originalPdfFilename || docInfo?.originalPdfFilename || null;
    const pageNumber = item._pageNumber || 1;
    const totalPages = item._totalPages || docInfo?.totalPages || null;
    
    console.log("[Timeline] Opening document:", { 
      title: item._source, 
      pdfFilename, 
      page: pageNumber 
    });
    
    // Dispatch global event to open document viewer
    openDocumentViewer(item._source, pdfFilename, pageNumber, totalPages);
  }, [docMap]);

  if (!hasData && allItems.length === 0) return null;

  return (
    <>
      <style>{TIMELINE_STYLES}</style>
      
      <div 
        className={`w-full bg-theme-bg-container border-b border-theme-sidebar-border historical-timeline-container ${
          isFullWidth ? "fixed inset-0 z-50 overflow-auto" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-sidebar-border/50 bg-theme-bg-secondary/30">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:bg-theme-sidebar-item-hover px-2 py-1 rounded transition-all duration-200"
          >
            <Clock size={16} weight="bold" className="text-theme-text-secondary" />
            <span className="text-sm font-medium text-theme-text-primary">
              Historical Timeline
            </span>
            <span className="text-xs text-white/50 bg-theme-bg-secondary px-2 py-0.5 rounded-full">
              {selectedYear ? `${filteredItems.length}/${stats.total}` : stats.total} events
            </span>
            {stats.primary > 0 && (
              <span className="text-xs text-amber-400/80 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Anchor size={10} weight="fill" />
                {stats.primary}
              </span>
            )}
            {stats.secondary > 0 && (
              <span className="text-xs text-slate-400/80 bg-slate-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <BookOpen size={10} weight="fill" />
                {stats.secondary}
              </span>
            )}
            <CaretDown 
              size={12}
              weight="bold"
              className={`text-theme-text-secondary transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`} 
            />
          </button>

          {/* Controls */}
          {isExpanded && (
            <div className="flex items-center gap-1">
              {/* Year filter dropdown */}
              <div className="relative group">
                <button
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    selectedYear 
                      ? "bg-blue-500/20 text-blue-400" 
                      : "hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary"
                  }`}
                  title="Filter by year"
                >
                  <FunnelSimple size={12} weight="bold" />
                  {selectedYear || "Year"}
                </button>
                <div className="absolute right-0 top-full mt-1 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-48 overflow-y-auto min-w-[80px]">
                  <button
                    onClick={() => handleYearSelect(null)}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-theme-sidebar-item-hover ${
                      !selectedYear ? "text-blue-400 bg-blue-500/10" : "text-theme-text-secondary"
                    }`}
                  >
                    All years
                  </button>
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-theme-sidebar-item-hover ${
                        selectedYear === year ? "text-blue-400 bg-blue-500/10" : "text-theme-text-secondary"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-4 bg-theme-sidebar-border mx-1" />
              
              <button
                onClick={handleMoveLeft}
                className="p-1.5 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors text-xs"
                title="Move left"
              >
                ←
              </button>
              <button
                onClick={handleMoveRight}
                className="p-1.5 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors text-xs"
                title="Move right"
              >
                →
              </button>
              
              <div className="w-px h-4 bg-theme-sidebar-border mx-1" />
              
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors text-xs"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors text-xs"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={handleFit}
                className="px-2 py-1 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors text-[10px]"
                title="Fit all"
              >
                Fit
              </button>
              
              <div className="w-px h-4 bg-theme-sidebar-border mx-1" />
              
              <button
                onClick={() => setIsFullWidth(!isFullWidth)}
                className="p-1.5 rounded hover:bg-theme-sidebar-item-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors"
                title={isFullWidth ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullWidth ? <ArrowsInSimple size={14} weight="bold" /> : <ArrowsOutSimple size={14} weight="bold" />}
              </button>
            </div>
          )}
        </div>

        {/* Year quick navigation */}
        {isExpanded && years.length > 1 && (
          <div className="flex items-center gap-1 px-4 py-1.5 bg-theme-bg-secondary/20 border-b border-theme-sidebar-border/30 overflow-x-auto">
            <span className="text-[10px] text-theme-text-secondary mr-2 shrink-0">Years:</span>
            <button
              onClick={() => handleYearSelect(null)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors shrink-0 ${
                !selectedYear 
                  ? "bg-blue-500/30 text-blue-300" 
                  : "text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-sidebar-item-hover"
              }`}
            >
              All
            </button>
            {years.map(year => {
              const count = allItems.filter(i => i.year === year).length;
              return (
                <button
                  key={year}
                  onClick={() => handleYearSelect(year)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors shrink-0 ${
                    selectedYear === year 
                      ? "bg-amber-500/30 text-amber-300" 
                      : "text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-sidebar-item-hover"
                  }`}
                >
                  {year} <span className="opacity-50">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Timeline container */}
        {isExpanded && (
          <div 
            className="relative"
            style={{ height: isFullWidth ? "calc(100vh - 100px)" : height }}
          >
            {filteredItems.length > 0 ? (
              <div 
                ref={containerRef}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
                No events for {selectedYear}. 
                <button 
                  onClick={() => setSelectedYear(null)}
                  className="ml-2 text-blue-400 hover:underline"
                >
                  Show all
                </button>
              </div>
            )}
            
            {/* Resize handle */}
            {!isFullWidth && (
              <div 
                className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize group ${
                  isResizing ? "bg-[#46c8ff]/20" : "hover:bg-white/5"
                }`}
                onMouseDown={handleResizeStart}
              >
                <div className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-16 h-1 rounded-full transition-colors ${
                  isResizing ? "bg-[#46c8ff]" : "bg-white/15 group-hover:bg-white/30"
                }`} />
              </div>
            )}
          </div>
        )}

        {/* Selected item details panel */}
        {selectedItem && (
          <div className="px-4 py-3 border-t border-theme-sidebar-border bg-theme-bg-secondary/50">
            <div className="flex items-start gap-3">
              <div 
                className="w-3 h-3 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: selectedItem._isPrimary ? "#F59E0B" : "#64748b" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="text-xs font-medium"
                    style={{ color: selectedItem._isPrimary ? "#F59E0B" : "#94a3b8" }}
                  >
                    {formatDateLong(selectedItem.start)}
                  </span>
                  {selectedItem._pageNumber && (
                    <span className="text-[10px] text-theme-text-secondary bg-theme-bg-secondary px-1.5 py-0.5 rounded">
                      Page {selectedItem._pageNumber}
                    </span>
                  )}
                </div>
                <div className="text-sm text-theme-text-primary leading-relaxed">
                  {selectedItem._fullSummary}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-theme-text-secondary">
                    Source: {selectedItem._source}
                  </span>
                  <button
                    onClick={() => handleOpenDocument(selectedItem)}
                    className="flex items-center gap-1 text-xs text-[#46c8ff] hover:text-[#46c8ff]/80 transition-colors"
                  >
                    <BookOpenText size={12} weight="bold" />
                    View in Document
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-theme-text-secondary hover:text-theme-text-primary text-lg shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Cluster items panel - shows all events when clicking a cluster */}
        {clusterItems && clusterItems.length > 0 && (
          <div className="border-t border-theme-sidebar-border bg-theme-bg-secondary/50 max-h-64 overflow-y-auto">
            <div className="px-4 py-2 border-b border-theme-sidebar-border/50 flex items-center justify-between sticky top-0 bg-theme-bg-secondary">
              <span className="text-xs font-medium text-theme-text-primary">
                📅 {clusterItems.length} events on {formatDateShort(clusterItems[0].start)}
              </span>
              <button
                onClick={() => setClusterItems(null)}
                className="text-theme-text-secondary hover:text-theme-text-primary text-lg"
              >
                ×
              </button>
            </div>
            <div className="divide-y divide-theme-sidebar-border/30">
              {clusterItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="px-4 py-2 hover:bg-theme-sidebar-item-hover cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedItem(item);
                    setClusterItems(null);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div 
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: item._isPrimary ? "#F59E0B" : "#64748b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-theme-text-primary line-clamp-2">
                        {item._fullSummary}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item._pageNumber && (
                          <span className="text-[10px] text-theme-text-secondary">
                            Page {item._pageNumber}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocument(item);
                          }}
                          className="text-[10px] text-[#46c8ff] hover:underline"
                        >
                          View PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatDateLong(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}
