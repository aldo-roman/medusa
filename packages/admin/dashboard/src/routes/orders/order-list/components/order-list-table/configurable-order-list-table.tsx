import { useState, useMemo, useCallback, useEffect } from "react"
import { Container, Button } from "@medusajs/ui"
import { keepPreviousData } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { DataTable } from "../../../../../components/data-table"
import { useOrders } from "../../../../../hooks/api/orders"
import { useConfigurableOrderTableColumns } from "../../../../../hooks/table/columns/use-configurable-order-table-columns"
import { useOrderTableFilters } from "./use-order-table-filters"
import { useOrderTableQuery } from "../../../../../hooks/table/query/use-order-table-query"
import { useViewConfigurations } from "../../../../../hooks/use-view-configurations"
import { useEntityColumns } from "../../../../../hooks/api/views"
import { useFeatureFlag } from "../../../../../providers/feature-flag-provider"
import { useColumnState } from "../../../../../hooks/table/columns/use-column-state"
import { useQueryParams } from "../../../../../hooks/use-query-params"
import { SaveViewDropdown } from "./components/save-view-dropdown"
import { SaveViewDialog } from "../../../../../components/table/save-view-dialog"
import { useRequiredFields } from "./hooks/use-required-fields"

const PAGE_SIZE = 20
const QUERY_PREFIX = "o"

function parseSortingState(value: string) {
  return value.startsWith("-")
    ? { id: value.slice(1), desc: true }
    : { id: value, desc: false }
}

export const ConfigurableOrderListTable = () => {
  const { t } = useTranslation()
  const isViewConfigEnabled = useFeatureFlag("view_configurations")

  // Get view configurations
  const {
    activeView,
    createView,
  } = useViewConfigurations("orders")

  const currentActiveView = activeView?.view_configuration || null

  // Get columns from API
  const { columns: apiColumns, isLoading: isLoadingColumns } = useEntityColumns("orders", {
    enabled: isViewConfigEnabled,
  })

  // Get filters
  const filters = useOrderTableFilters()

  // Get current query params
  const queryParams = useQueryParams(
    ["q", "order", ...filters.map(f => f.id)],
    QUERY_PREFIX
  )

  // Get setSearchParams hook
  const [_, setSearchParams] = useSearchParams()

  // Use column state hook
  const {
    visibleColumns,
    columnOrder,
    currentColumns,
    setColumnOrder,
    handleColumnVisibilityChange,
    handleViewChange: originalHandleViewChange,
  } = useColumnState(apiColumns, currentActiveView)

  // Wrap handleViewChange to manage transition state and apply view configuration
  const handleViewChange = useCallback((view: any) => {
    originalHandleViewChange(view, apiColumns || [])

    // Apply the view's filters, sorting, and search to URL params
    setSearchParams((prev) => {
      // Clear all existing parameters with the prefix
      const keysToDelete = Array.from(prev.keys()).filter(key =>
        key.startsWith(QUERY_PREFIX + "_") || key === QUERY_PREFIX + "_q" || key === QUERY_PREFIX + "_order"
      )
      keysToDelete.forEach(key => prev.delete(key))

      if (view) {
        // Apply view's configuration
        const viewConfig = view.configuration

        // Apply filters
        if (viewConfig.filters) {
          Object.entries(viewConfig.filters).forEach(([key, value]) => {
            prev.set(`${QUERY_PREFIX}_${key}`, JSON.stringify(value))
          })
        }

        // Apply sorting
        if (viewConfig.sorting) {
          const sortValue = viewConfig.sorting.desc
            ? `-${viewConfig.sorting.id}`
            : viewConfig.sorting.id
          prev.set(`${QUERY_PREFIX}_order`, sortValue)
        }

        // Apply search
        if (viewConfig.search) {
          prev.set(`${QUERY_PREFIX}_q`, viewConfig.search)
        }
      }

      return prev
    })
  }, [originalHandleViewChange, setSearchParams, apiColumns])

  // Debounced state for configuration changes
  const [debouncedHasConfigChanged, setDebouncedHasConfigChanged] = useState(false)

  // Check if configuration has diverged from the active view
  const hasConfigurationChanged = useMemo(() => {
    // Get current state
    const currentFilters: Record<string, any> = {}
    filters.forEach(filter => {
      if (queryParams[filter.id] !== undefined) {
        currentFilters[filter.id] = JSON.parse(queryParams[filter.id])
      }
    })

    const currentSorting = queryParams.order ? parseSortingState(queryParams.order) : null
    const currentSearch = queryParams.q || ""
    const currentVisibleColumns = Object.entries(visibleColumns)
      .filter(([_, isVisible]) => isVisible)
      .map(([field]) => field)
      .sort()

    if (currentActiveView) {
      // Compare against active view configuration
      const viewFilters = currentActiveView.configuration.filters || {}
      const viewSorting = currentActiveView.configuration.sorting
      const viewSearch = currentActiveView.configuration.search || ""
      const viewVisibleColumns = [...(currentActiveView.configuration.visible_columns || [])].sort()
      const viewColumnOrder = currentActiveView.configuration.column_order || []

      // Check filters
      const filterKeys = new Set([...Object.keys(currentFilters), ...Object.keys(viewFilters)])
      for (const key of filterKeys) {
        if (JSON.stringify(currentFilters[key]) !== JSON.stringify(viewFilters[key])) {
          return true
        }
      }

      // Check sorting
      const normalizedCurrentSorting = currentSorting || undefined
      const normalizedViewSorting = viewSorting || undefined
      if (JSON.stringify(normalizedCurrentSorting) !== JSON.stringify(normalizedViewSorting)) {
        return true
      }

      // Check search
      if (currentSearch !== viewSearch) {
        return true
      }

      // Check visible columns
      if (JSON.stringify(currentVisibleColumns) !== JSON.stringify(viewVisibleColumns)) {
        return true
      }

      // Check column order
      if (JSON.stringify(columnOrder) !== JSON.stringify(viewColumnOrder)) {
        return true
      }
    } else {
      // No active view - check if we have any non-default state
      if (Object.keys(currentFilters).length > 0) return true
      if (currentSorting !== null) return true
      if (currentSearch !== "") return true

      // Check if columns differ from API defaults
      if (apiColumns) {
        const currentVisibleSet = new Set(
          Object.entries(visibleColumns)
            .filter(([_, isVisible]) => isVisible)
            .map(([field]) => field)
        )

        const defaultVisibleSet = new Set(
          apiColumns
            .filter(col => col.default_visible)
            .map(col => col.field)
        )

        // Check if the sets are different
        if (currentVisibleSet.size !== defaultVisibleSet.size ||
          [...currentVisibleSet].some(field => !defaultVisibleSet.has(field))) {
          return true
        }

        // Also check column order against defaults
        const defaultOrder = apiColumns
          .sort((a, b) => (a.default_order ?? 500) - (b.default_order ?? 500))
          .map(col => col.field)

        if (JSON.stringify(columnOrder) !== JSON.stringify(defaultOrder)) {
          return true
        }
      }
    }

    return false
  }, [currentActiveView, visibleColumns, columnOrder, filters, queryParams, apiColumns])

  // Debounce the configuration changed state
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHasConfigChanged(hasConfigurationChanged)
    }, 50)

    return () => clearTimeout(timer)
  }, [hasConfigurationChanged])

  // Handler to reset configuration back to active view
  const handleClearConfiguration = useCallback(() => {
    if (currentActiveView) {
      // Reset to active view's configuration
      handleViewChange(currentActiveView)
    } else {
      // No active view - clear all configuration including URL params
      handleViewChange(null)

      // Clear all query parameters
      setSearchParams((prev) => {
        // Remove all parameters with our prefix
        const keysToDelete = Array.from(prev.keys()).filter(key =>
          key.startsWith(QUERY_PREFIX + "_") || key === QUERY_PREFIX + "_q" || key === QUERY_PREFIX + "_order"
        )
        keysToDelete.forEach(key => prev.delete(key))
        return prev
      })
    }
  }, [currentActiveView, handleViewChange, setSearchParams])

  // Get current configuration for save button
  const currentConfiguration = useMemo(() => {
    const currentFilters: Record<string, any> = {}
    filters.forEach(filter => {
      if (queryParams[filter.id] !== undefined) {
        currentFilters[filter.id] = JSON.parse(queryParams[filter.id])
      }
    })

    return {
      filters: currentFilters,
      sorting: queryParams.order ? parseSortingState(queryParams.order) : null,
      search: queryParams.q || "",
    }
  }, [filters, queryParams])

  // Save view handlers
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [editingView, setEditingView] = useState<any>(null)

  const handleSaveAsDefault = async () => {
    try {
      await createView.mutateAsync({
        name: "Default",
        is_system_default: true,
        set_active: true,
        configuration: {
          visible_columns: currentColumns.visible,
          column_order: currentColumns.order,
          filters: currentConfiguration.filters || {},
          sorting: currentConfiguration.sorting || null,
          search: currentConfiguration.search || "",
        }
      })
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleUpdateExisting = async () => {
    if (!currentActiveView) return

    // For now, open the save dialog to update
    setEditingView(currentActiveView)
    setSaveDialogOpen(true)
  }

  const handleSaveAsNew = () => {
    setSaveDialogOpen(true)
    setEditingView(null)
  }

  // Calculate required fields based on visible columns
  const requiredFields = useRequiredFields(apiColumns, visibleColumns)

  // Create filter bar content - use debounced state to prevent flashing
  const filterBarContent = debouncedHasConfigChanged ? (
    <>
      <Button
        variant="secondary"
        size="small"
        type="button"
        onClick={handleClearConfiguration}
      >
        {t("actions.clear")}
      </Button>
      <SaveViewDropdown
        isDefaultView={!currentActiveView}
        currentViewId={currentActiveView?.id}
        currentViewName={currentActiveView?.name}
        onSaveAsDefault={handleSaveAsDefault}
        onUpdateExisting={handleUpdateExisting}
        onSaveAsNew={handleSaveAsNew}
      />
    </>
  ) : null

  // Fetch orders data
  const { searchParams, raw } = useOrderTableQuery({
    pageSize: PAGE_SIZE,
    prefix: QUERY_PREFIX,
  })

  const { orders, count, isError, error, isLoading } = useOrders(
    {
      fields: requiredFields,
      ...searchParams,
    },
    {
      placeholderData: keepPreviousData,
    }
  )

  // Build columns from API columns
  const columns = useConfigurableOrderTableColumns(apiColumns)


  if (isError) {
    throw error
  }

  return (
    <Container className="divide-y p-0">
      <DataTable
        data={orders ?? []}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        rowCount={count}
        enablePagination
        enableSearch
        pageSize={PAGE_SIZE}
        isLoading={isLoading || isLoadingColumns}
        layout="fill"
        heading={t("orders.domain")}
        enableColumnVisibility={isViewConfigEnabled}
        initialColumnVisibility={visibleColumns}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        enableViewSelector={isViewConfigEnabled}
        entity="orders"
        onViewChange={handleViewChange}
        currentColumns={currentColumns}
        filterBarContent={filterBarContent}
        rowHref={(row) => `/orders/${row.id}`}
        emptyState={{
          message: t("orders.list.noRecordsMessage"),
        }}
        prefix={QUERY_PREFIX}
      />

      {saveDialogOpen && (
        <SaveViewDialog
          entity="orders"
          currentColumns={currentColumns}
          currentConfiguration={currentConfiguration}
          editingView={editingView}
          onClose={() => {
            setSaveDialogOpen(false)
            setEditingView(null)
          }}
          onSaved={(newView) => {
            setSaveDialogOpen(false)
            setEditingView(null)
            // The view will be automatically set as active if set_active was true
            if (newView) {
              handleViewChange(newView)
            }
          }}
        />
      )}
    </Container>
  )
}
