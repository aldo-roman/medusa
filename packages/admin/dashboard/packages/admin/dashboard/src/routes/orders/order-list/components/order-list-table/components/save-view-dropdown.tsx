import React, { useState } from "react"
import { Button, DropdownMenu, toast } from "@medusajs/ui"
import { ChevronDownMini } from "@medusajs/icons"
import { useTranslation } from "react-i18next"
import { useViewConfiguration } from "../../../../../../providers/view-configuration-provider"
import { SaveViewDialog } from "../../../../../../components/table/save-view-dialog"

interface SaveViewDropdownProps {
  entity: string
  isDefaultView: boolean
  currentViewId?: string
  currentViewName?: string
  currentColumns?: {
    visible: string[]
    order: string[]
  }
  currentConfiguration?: {
    filters?: Record<string, unknown>
    sorting?: { id: string; desc: boolean } | null
    search?: string
  }
}

export const SaveViewDropdown: React.FC<SaveViewDropdownProps> = ({
  entity,
  isDefaultView,
  currentViewId,
  currentViewName,
  currentColumns,
  currentConfiguration,
}) => {
  const { t } = useTranslation()
  const { createViewConfiguration, updateViewConfiguration, getViewConfigurations } = useViewConfiguration()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveMode, setSaveMode] = useState<"new" | "update" | "system_default" | null>(null)

  const handleSaveAsDefault = async () => {
    try {
      if (!currentColumns || !currentConfiguration) {
        toast.error("Configuration data is missing")
        return
      }

      // Check if a system default already exists
      const existingViews = await getViewConfigurations(entity)
      const existingSystemDefault = existingViews.find(view => view.is_system_default)

      const viewConfig = {
        entity,
        name: "Default",
        configuration: {
          visible_columns: currentColumns.visible,
          column_order: currentColumns.order,
          filters: currentConfiguration.filters || {},
          sorting: currentConfiguration.sorting,
          search: currentConfiguration.search,
        },
        is_system_default: true,
        set_active: true, // Set as active when saving as default for everyone
      }

      if (existingSystemDefault) {
        // Update the existing system default - exclude entity field
        const { entity: _, ...updateConfig } = viewConfig
        const updatedView = await updateViewConfiguration(existingSystemDefault.id, updateConfig)
        
        // Force a small delay to ensure state propagation
        setTimeout(() => {
          // The view configuration provider will handle the state update
        }, 100)
      } else {
        // Create a new system default
        const newView = await createViewConfiguration(viewConfig)
        
        // Force a small delay to ensure state propagation
        setTimeout(() => {
          // The view configuration provider will handle the state update
        }, 100)
      }

      toast.success("Default view saved for everyone")
    } catch (error) {
      toast.error("Failed to save default view")
    }
  }

  const handleSaveAsNew = () => {
    setSaveMode("new")
    setSaveDialogOpen(true)
  }

  const handleUpdateView = async () => {
    try {
      if (!currentColumns || !currentConfiguration || !currentViewId) {
        toast.error("Configuration data is missing")
        return
      }

      const updateData: any = {
        configuration: {
          visible_columns: currentColumns.visible,
          column_order: currentColumns.order,
          filters: currentConfiguration.filters || {},
          sorting: currentConfiguration.sorting || null,
          search: currentConfiguration.search || "",
        },
        set_active: true, // Ensure the view remains active after update
      }

      const updatedView = await updateViewConfiguration(currentViewId, updateData)
      toast.success(`View "${currentViewName}" updated successfully`)
      
      // Force a small delay to ensure state propagation
      setTimeout(() => {
        // The view configuration provider will handle the state update
      }, 100)
    } catch (error) {
      toast.error("Failed to update view")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button size="small" variant="secondary">
            {t("general.save")}
            <ChevronDownMini />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {isDefaultView ? (
            <>
              <DropdownMenu.Item onClick={handleSaveAsDefault}>
                {t("orders.saveAsDefaultForEveryone")}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={handleSaveAsNew}>
                {t("orders.saveAsNewView")}
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item onClick={handleUpdateView}>
                {t("orders.saveView") || "Save view"}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={handleSaveAsNew}>
                {t("orders.saveAsNewView")}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {saveDialogOpen && (
        <SaveViewDialog
          entity={entity}
          currentColumns={currentColumns}
          currentConfiguration={currentConfiguration}
          editingView={
            saveMode === "update" && currentViewId
              ? { id: currentViewId, name: currentViewName || "" }
              : null
          }
          onClose={() => {
            setSaveDialogOpen(false)
            setSaveMode(null)
          }}
          onSaved={(newView) => {
            setSaveDialogOpen(false)
            setSaveMode(null)
            if (saveMode === "update") {
              toast.success(`View "${newView.name}" updated successfully`)
            } else {
              toast.success(`View "${newView.name}" saved successfully`)
            }
          }}
        />
      )}
    </>
  )
}