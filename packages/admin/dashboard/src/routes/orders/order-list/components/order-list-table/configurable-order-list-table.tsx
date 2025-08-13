import { Container } from "@medusajs/ui"
import { keepPreviousData } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useMemo, useEffect } from "react"

import { DataTable } from "../../../../../components/data-table"
import { useOrders } from "../../../../../hooks/api/orders"
import { useOrderTableColumns } from "../../../../../hooks/table/columns/use-order-table-columns"
import { useOrderTableFilters } from "../../../../../hooks/table/filters/use-order-table-filters"
import { useOrderTableQuery } from "../../../../../hooks/table/query/use-order-table-query"
import { useViewConfigurations } from "../../../../../hooks/use-view-configurations"
import { useFeatureFlag } from "../../../../../providers/feature-flag-provider"
import { useColumnState } from "../../../../../hooks/table/columns/use-column-state"

import { DEFAULT_FIELDS } from "../../const"

const PAGE_SIZE = 20

export const ConfigurableOrderListTable = () => {
  const { t } = useTranslation()
  const isViewConfigEnabled = useFeatureFlag("view_configurations")
  
  // Get view configurations
  const { activeView } = useViewConfigurations("orders")
  
  // Use column state hook
  const {
    visibleColumns,
    columnOrder,
    columnState,
    currentColumns,
    setColumnOrder,
    handleColumnVisibilityChange,
    handleViewChange,
    initializeColumns,
  } = useColumnState(undefined, activeView)

  const { searchParams, raw } = useOrderTableQuery({
    pageSize: PAGE_SIZE,
  })

  const { orders, count, isError, error, isLoading } = useOrders(
    {
      fields: DEFAULT_FIELDS,
      ...searchParams,
    },
    {
      placeholderData: keepPreviousData,
    }
  )

  const filters = useOrderTableFilters()
  const columns = useOrderTableColumns({})


  // Handle view change
  const onViewChange = useMemo(() => {
    return (view: any) => handleViewChange(view, [])
  }, [handleViewChange])

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
        isLoading={isLoading}
        layout="fill"
        heading={t("orders.domain")}
        enableColumnVisibility={isViewConfigEnabled}
        initialColumnVisibility={visibleColumns}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        enableViewSelector={isViewConfigEnabled}
        entity="orders"
        onViewChange={onViewChange}
        currentColumns={currentColumns}
        rowHref={(row) => `/orders/${row.id}`}
        emptyState={{
          message: t("orders.list.noRecordsMessage"),
        }}
      />
    </Container>
  )
}