import { useMemo } from "react"
import { HttpTypes } from "@medusajs/types"
import { toast } from "@medusajs/ui"
import { FetchError } from "@medusajs/js-sdk"
import { useFeatureFlag } from "../providers/feature-flag-provider"
import {
  useViewConfigurations as useViewConfigurationsBase,
  useActiveViewConfiguration as useActiveViewConfigurationBase,
  useCreateViewConfiguration as useCreateViewConfigurationBase,
  useUpdateViewConfiguration as useUpdateViewConfigurationBase,
  useDeleteViewConfiguration as useDeleteViewConfigurationBase,
  useSetActiveViewConfiguration as useSetActiveViewConfigurationBase,
} from "./api/views"

// Re-export the type for convenience
export type ViewConfiguration = HttpTypes.AdminViewConfiguration

// Common error handler
const handleError = (error: Error, message?: string) => {
  let errorMessage = message
  if (!errorMessage) {
    if (error instanceof FetchError) {
      errorMessage = error.message
    } else if (error.message) {
      errorMessage = error.message
    } else {
      errorMessage = "An error occurred"
    }
  }

  toast.error(errorMessage)
}

export const useViewConfigurations = (entity: string) => {
  const isViewConfigEnabled = useFeatureFlag("view_configurations")

  // List views
  const listViews = useViewConfigurationsBase(entity, { limit: 100 }, {
    enabled: isViewConfigEnabled && !!entity,
    onError: (error) => {
      handleError(error, "Failed to load view configurations")
    },
  })

  // Active view
  const activeView = useActiveViewConfigurationBase(entity, {
    enabled: isViewConfigEnabled && !!entity,
    onError: (error) => {
      // Don't show error toast for active view fetch - it's expected to fail sometimes
      console.error("Failed to fetch active view configuration:", error)
    },
  })

  // Create view mutation
  const createView = useCreateViewConfigurationBase(entity, {
    onSuccess: (data) => {
      toast.success(`View "${data.view_configuration.name}" created successfully`)
    },
    onError: (error) => {
      handleError(error, "Failed to create view")
    },
  })

  // Set active view mutation
  const setActiveView = useSetActiveViewConfigurationBase(entity, {
    onSuccess: () => {
      console.log("success")
      toast.success("Active view updated")
    },
    onError: (error) => {
      handleError(error, "Failed to update active view")
    },
  })

  console.log("active in hooks", activeView)

  return useMemo(() => ({
    // Feature flag state
    isViewConfigEnabled,

    // Query results
    listViews,
    activeView,

    // Mutations
    createView,
    setActiveView,

    // Helper to check if default view is active
    isDefaultViewActive: activeView?.is_default_active ?? true,
  }), [
    isViewConfigEnabled,
    listViews,
    activeView,
    createView,
    setActiveView,
  ])
}

// Hook for update/delete operations on a specific view
export const useViewConfiguration = (entity: string, viewId: string) => {
  const updateView = useUpdateViewConfigurationBase(entity, viewId, {
    onSuccess: (data) => {
      toast.success(`View "${data.view_configuration.name}" updated successfully`)
    },
    onError: (error) => {
      handleError(error, "Failed to update view")
    },
  })

  const deleteView = useDeleteViewConfigurationBase(entity, viewId, {
    onSuccess: () => {
      toast.success("View deleted successfully")
    },
    onError: (error) => {
      handleError(error, "Failed to delete view")
    },
  })

  return {
    updateView,
    deleteView,
  }
}
