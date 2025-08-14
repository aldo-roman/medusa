import React, { useState } from "react"
import {
  Button,
  Input,
  Label,
  Switch,
  FocusModal,
  Hint,
  toast,
} from "@medusajs/ui"
import { useForm, Controller } from "react-hook-form"
import { useViewConfigurations, useViewConfiguration } from "../../../hooks/use-view-configurations"
import type { ViewConfiguration } from "../../../hooks/use-view-configurations"


type SaveViewFormData = {
  name: string
  isSystemDefault: boolean
}

interface SaveViewDialogProps {
  entity: string
  currentColumns?: {
    visible: string[]
    order: string[]
  }
  currentConfiguration?: {
    filters?: Record<string, unknown>
    sorting?: { id: string; desc: boolean } | null
    search?: string
  }
  editingView?: ViewConfiguration | null
  onClose: () => void
  onSaved: (view: ViewConfiguration) => void
}

export const SaveViewDialog: React.FC<SaveViewDialogProps> = ({
  entity,
  currentColumns,
  currentConfiguration,
  editingView,
  onClose,
  onSaved,
}) => {
  const { createView } = useViewConfigurations(entity)
  const { updateView } = useViewConfiguration(entity, editingView?.id || '')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
  } = useForm<SaveViewFormData>({
    mode: "onChange",
    defaultValues: {
      name: editingView?.name || "",
      isSystemDefault: editingView?.is_system_default || false,
    },
  })

  const isSystemDefault = watch("isSystemDefault")
  
  const isAdmin = true // TODO: Get from auth context

  const onSubmit = async (data: SaveViewFormData) => {
    // Manual validation for new views
    if (!editingView && !data.isSystemDefault && (!data.name || !data.name.trim())) {
      toast.error("Name is required unless setting as system default")
      return
    }
    
    // Validation for editing views - if converting to system default without a name, that's ok
    if (editingView && !data.isSystemDefault && !editingView.name && (!data.name || !data.name.trim())) {
      toast.error("Name is required for personal views")
      return
    }
    
    if (!currentColumns && !editingView) {
      toast.error("No column configuration to save")
      return
    }

    setIsLoading(true)
    try {
      if (editingView) {
        // Update existing view
        const updateData: any = {
          is_system_default: data.isSystemDefault,
          set_active: true, // Always set updated view as active
        }

        // Only include name if it was provided and changed (empty string means keep current)
        if (data.name && data.name.trim() !== "" && data.name !== editingView.name) {
          updateData.name = data.name
        }

        // Only update configuration if currentColumns is provided
        if (currentColumns) {
          updateData.configuration = {
            visible_columns: currentColumns.visible,
            column_order: currentColumns.order,
            filters: currentConfiguration?.filters || {},
            sorting: currentConfiguration?.sorting || null,
            search: currentConfiguration?.search || "",
          }
        }

        const result = await updateView.mutateAsync(updateData)
        onSaved(result.view_configuration)
      } else {
        // Create new view
        if (!currentColumns) {
          toast.error("No column configuration to save")
          return
        }

        // Only include name if provided (not required for system defaults)
        const createData: any = {
          is_system_default: data.isSystemDefault,
          set_active: true, // Always set newly created view as active
          configuration: {
            visible_columns: currentColumns.visible,
            column_order: currentColumns.order,
            filters: currentConfiguration?.filters || {},
            sorting: currentConfiguration?.sorting || null,
            search: currentConfiguration?.search || "",
          },
        }
        
        // Only add name if it's provided and not empty
        if (data.name && data.name.trim()) {
          createData.name = data.name.trim()
        }
        
        const result = await createView.mutateAsync(createData)
        onSaved(result.view_configuration)
      }
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <FocusModal open onOpenChange={onClose}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center justify-between">
            <FocusModal.Title>
              {editingView ? "Edit View" : "Save View"}
            </FocusModal.Title>
          </div>
        </FocusModal.Header>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FocusModal.Body className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="name" weight="plus">
                View Name {(editingView || isSystemDefault) && <span className="text-ui-fg-muted font-normal">(optional)</span>}
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder={
                  editingView 
                    ? editingView.name 
                    : isSystemDefault 
                      ? "Leave empty for no name" 
                      : "e.g., My Custom View"
                }
                autoComplete="off"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-y-1">
                  <Label htmlFor="isSystemDefault" weight="plus">
                    Set as System Default
                  </Label>
                  <Hint>
                    This view will be the default for all users
                  </Hint>
                </div>
                <Controller
                  name="isSystemDefault"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="isSystemDefault"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}

            {editingView && (
              <div className="rounded-md bg-ui-bg-subtle p-3">
                <p className="text-ui-fg-subtle text-sm">
                  You are editing the view "{editingView.name}".
                  {editingView.is_system_default && (
                    <span className="block mt-1 text-ui-fg-warning">
                      This is a system default view.
                    </span>
                  )}
                </p>
              </div>
            )}

            {!isAdmin && isSystemDefault && (
              <Hint variant="error">
                Only administrators can create system default views
              </Hint>
            )}
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex items-center gap-x-2">
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="small"
                type="submit"
                isLoading={isLoading}
                disabled={!isAdmin && isSystemDefault}
              >
                {editingView ? "Update" : "Save"} View
              </Button>
            </div>
          </FocusModal.Footer>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}