import React, { useState } from "react";
import {
  importFromDirectus,
  previewCollectionItems,
  importSelectedItems,
  getRelations,
} from "../lib/apiHandlers";
import { FlowsManager } from "./FlowsManager";
import { AccessControlManager } from "./AccessControlManager";
import { DocumentationTab } from "./DocumentationTab";
import { ItemSelectorModal } from "./ItemSelectorModal";
import { FilesManager } from "./FilesManager";
import type { Collection, OperationStatus } from "../types";

interface CollectionListProps {
  collections: Collection[];
  sourceUrl: string;
  sourceToken: string;
  targetUrl: string;
  targetToken: string;
  onStatusUpdate: (status: OperationStatus | null) => void;
  onRefreshCollections: () => Promise<void>;
  loading: Record<string, boolean>;
  setLoading: (key: string, state: boolean) => void;
}

export function CollectionList({
  collections,
  sourceUrl,
  sourceToken,
  targetUrl,
  targetToken,
  onStatusUpdate: _onStatusUpdate,
  onRefreshCollections,
  loading,
  setLoading,
}: CollectionListProps) {
  const onStatusUpdate = (_status: any) => {};
  const [importLimit] = useState<number | null>(null);
  const [titleFilter] = useState<string>("");
  const [collectionSearchTerm, setCollectionSearchTerm] = useState<string>("");
  const [showFlowsManager, setShowFlowsManager] = useState(false);
  const [showAccessControlManager, setShowAccessControlManager] =
    useState(false);
  const [showFilesManager, setShowFilesManager] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [showSystemCollections, setShowSystemCollections] = useState(false);
  const [systemCollectionsAcknowledged, setSystemCollectionsAcknowledged] =
    useState(false);
  const [targetCollections, setTargetCollections] = useState<Collection[]>([]);
  const [statusFilter, setStatusFilter] = useState<"existing" | "new">(
    "existing"
  );
  const [showNewCollectionWarning, setShowNewCollectionWarning] =
    useState(false);
  const [schemaMigrationStep, setSchemaMigrationStep] = useState<
    "idle" | "snapshot" | "diff" | "apply" | "complete"
  >("idle");
  const [schemaSnapshot, setSchemaSnapshot] = useState<any>(null);
  const [schemaDiff, setSchemaDiff] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<
    Array<{ id: string; timestamp: string; operation: string; category: "schema" | "data"; error: any }>
  >([]);
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  const [errorLogCategory, setErrorLogCategory] = useState<"schema" | "data">("schema");
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [importProgress, setImportProgress] = useState<
    Record<string, { current: number; total: number }>
  >({});
  const [selectedSchemaCollections, setSelectedSchemaCollections] = useState<
    string[]
  >([]);
  const [schemaCollectionFilter, setSchemaCollectionFilter] =
    useState<string>("");
  const [collapsedFieldDetails, setCollapsedFieldDetails] = useState<
    Record<string, boolean>
  >({});
  const [schemaMigratedCollections, setSchemaMigratedCollections] = useState<string[]>([]);
  const [dataMigratedCollections, setDataMigratedCollections] = useState<string[]>([]);

  const [schemaChangeFilter, setSchemaChangeFilter] = useState<
    "all" | "new" | "modified" | "deleted"
  >("all");
  const [schemaPageSize, setSchemaPageSize] = useState<number>(20);
  const [schemaPageNew, setSchemaPageNew] = useState<number>(1);
  const [schemaPageModified, setSchemaPageModified] = useState<number>(1);
  const [schemaPageDeleted, setSchemaPageDeleted] = useState<number>(1);

  const [schemaApplyIncludeCollections, setSchemaApplyIncludeCollections] =
    useState<boolean>(true);
  const [schemaApplyIncludeFields, setSchemaApplyIncludeFields] =
    useState<boolean>(true);
  const [schemaApplyIncludeRelations, setSchemaApplyIncludeRelations] =
    useState<boolean>(true);

  const [showItemSelector, setShowItemSelector] = useState(false);
  const [currentPreviewCollection, setCurrentPreviewCollection] =
    useState<string>("");
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [setPreviewOffset] = useState<number>(0);
  const [selectedItemIds, setSelectedItemIds] = useState<(string | number)[]>(
    []
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sourceRelations, setSourceRelations] = useState<any[]>([]);

  // New states for advanced import strategy
  const [excludeRelationalFields, setExcludeRelationalFields] = useState(true);
  const [showBestPracticeGuide, setShowBestPracticeGuide] = useState(true);
  const [importResults, setImportResults] = useState<
    Record<
      string,
      {
        success: Array<{ id: string | number; action: string }>;
        failed: Array<{ id: string | number; error: string }>;
      }
    >
  >({});
  const [showImportResults, setShowImportResults] = useState(false);

  const formatDiffValue = (value: any) => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return "[object Object]";
      }
    }
    return String(value);
  };

  const DetailSection = ({
    icon,
    title,
    accentColor,
    borderColor,
    backgroundColor,
    children,
  }: {
    icon: string;
    title: string;
    accentColor: string;
    borderColor: string;
    backgroundColor: string;
    children: React.ReactNode;
  }) => (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor,
        borderRadius: "6px",
        padding: "0.75rem",
        marginBottom: "0.75rem",
      }}
    >
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color: accentColor,
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          marginBottom: "0.5rem",
        }}
      >
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );

  const loadTargetCollections = async () => {
    try {
      const { getAllCollections } = await import("../lib/apiHandlers");
      const result = await getAllCollections(targetUrl, targetToken);
      if (result.success) {
        setTargetCollections(result.collections || []);
      }
    } catch (error) {}
  };

  const getCollectionStatus = (
    sourceCollection: Collection
  ): "existing" | "new" | "unknown" => {
    if (targetCollections.length === 0) {
      return "unknown";
    }
    const exists = targetCollections.some(
      (targetCollection) =>
        targetCollection.collection === sourceCollection.collection
    );
    return exists ? "existing" : "new";
  };

  React.useEffect(() => {
    if (targetUrl && targetToken) {
      loadTargetCollections();
    }
  }, [targetUrl, targetToken]);

  const findRelatedCollections = (
    collectionName: string,
    diffData: any
  ): Set<string> => {
    const relatedCollections = new Set<string>();

    if (!diffData?.diff) return relatedCollections;

    relatedCollections.add(collectionName);

    (diffData.diff.relations || []).forEach((relItem: any) => {
      const involvedInRelation =
        relItem.collection === collectionName ||
        relItem.related_collection === collectionName ||
        relItem.meta?.one_collection === collectionName ||
        relItem.meta?.many_collection === collectionName;

      if (involvedInRelation) {
        if (relItem.collection) relatedCollections.add(relItem.collection);
        if (relItem.related_collection)
          relatedCollections.add(relItem.related_collection);
        if (relItem.meta?.one_collection)
          relatedCollections.add(relItem.meta.one_collection);
        if (relItem.meta?.many_collection)
          relatedCollections.add(relItem.meta.many_collection);

        if (relItem.meta?.junction_field) {
          const junctionCollection = relItem.collection;
          if (junctionCollection) relatedCollections.add(junctionCollection);
        }

        if (
          relItem.meta?.one_allowed_collections &&
          Array.isArray(relItem.meta.one_allowed_collections)
        ) {
          relItem.meta.one_allowed_collections.forEach((col: string) => {
            if (col) relatedCollections.add(col);
          });
        }
      }
    });

    (diffData.diff.fields || []).forEach((fieldItem: any) => {
      if (fieldItem.collection === collectionName) {
        const fieldMeta = fieldItem.meta;
        const fieldInterface = fieldMeta?.interface || "";

        if (
          fieldInterface.includes("many-to-one") ||
          fieldInterface.includes("one-to-many") ||
          fieldInterface.includes("many-to-many") ||
          fieldInterface.includes("many-to-any") ||
          fieldInterface === "list-m2m" ||
          fieldInterface === "list-m2a" ||
          fieldInterface === "list-o2m" ||
          fieldInterface === "files" ||
          fieldInterface === "file" ||
          fieldInterface === "user" ||
          fieldInterface === "select-dropdown-m2o"
        ) {
          const options = fieldMeta?.options || {};

          if (options.collection) {
            relatedCollections.add(options.collection);
          }

          if (options.allow && Array.isArray(options.allow)) {
            options.allow.forEach((col: string) => {
              if (col) relatedCollections.add(col);
            });
          }

          if (
            fieldInterface === "file" ||
            fieldInterface === "files" ||
            fieldInterface === "file-image"
          ) {
            relatedCollections.add("directus_files");
          }

          if (
            fieldInterface === "user" ||
            (fieldInterface === "select-dropdown-m2o" &&
              options.collection === "directus_users")
          ) {
            relatedCollections.add("directus_users");
          }

          if (options.template) {
            const matches = options.template.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
            }
          }
        }

        const fieldSchema = fieldItem.schema;
        if (fieldSchema?.foreign_key_table) {
          relatedCollections.add(fieldSchema.foreign_key_table);
        }

        const fieldType = fieldSchema?.data_type || fieldItem.type;

        if (fieldType === "uuid" || fieldType === "char") {
          const fieldName = fieldItem.field?.toLowerCase() || "";

          if (
            fieldName.includes("user") ||
            fieldName === "owner" ||
            fieldName === "created_by" ||
            fieldName === "modified_by"
          ) {
            relatedCollections.add("directus_users");
          }
          if (
            fieldName.includes("file") ||
            fieldName.includes("image") ||
            fieldName.includes("avatar") ||
            fieldName.includes("thumbnail")
          ) {
            relatedCollections.add("directus_files");
          }
          if (fieldName.includes("folder")) {
            relatedCollections.add("directus_folders");
          }
        }
      }
    });

    relatedCollections.delete(collectionName);

    relatedCollections.add(collectionName);

    return relatedCollections;
  };

  const handleCollectionSelection = (
    collectionName: string,
    isChecked: boolean
  ) => {
    if (isChecked) {
      const relatedCollections = findRelatedCollections(
        collectionName,
        schemaDiff
      );

      const collectionsToAdd = Array.from(relatedCollections).filter((col) => {
        if (col.startsWith("directus_") && !showSystemCollections) return false;
        return true;
      });

      const newlyAdded = collectionsToAdd.filter(
        (col) => !selectedSchemaCollections.includes(col)
      );

      setSelectedSchemaCollections((prev) => [
        ...new Set([...prev, ...collectionsToAdd]),
      ]);

      if (newlyAdded.length > 1) {
        const autoSelected = newlyAdded.filter((col) => col !== collectionName);
        if (autoSelected.length > 0) {
          onStatusUpdate({
            type: "info",
            message: `✓ Auto-selected ${
              autoSelected.length
            } related collection(s): ${autoSelected.join(", ")}`,
          });
        }
      }
    } else {
      setSelectedSchemaCollections((prev) =>
        prev.filter((c) => c !== collectionName)
      );
    }
  };

  React.useEffect(() => {
    const loadSourceRelations = async () => {
      try {
        const result = await getRelations(sourceUrl, sourceToken);
        if (result.success && result.relations) {
          setSourceRelations(result.relations);
        }
      } catch (error) {}
    };

    if (sourceUrl && sourceToken) {
      loadSourceRelations();
    }
  }, [sourceUrl, sourceToken]);

  const handleSchemaSnapshot = async () => {
    setSchemaMigrationStep("snapshot");
    setLoading("schema_snapshot", true);

    try {
      const { DirectusClient } = await import("../lib/DirectusClient");
      const sourceClient = new DirectusClient(sourceUrl, sourceToken);

      const response = await sourceClient.get("/schema/snapshot");
      const snapshot = response.data || response;

      if (!snapshot || !Array.isArray(snapshot.collections)) {
        throw new Error("Invalid snapshot response");
      }

      // Remove systemFields property from collections as it's not allowed in schema/diff
      const cleanedSnapshot = {
        ...snapshot,
        collections: snapshot.collections.map((col: any) => {
          const { systemFields, ...rest } = col;
          return rest;
        }),
      };

      setSchemaSnapshot(cleanedSnapshot);
      setSchemaMigrationStep("diff");

      onStatusUpdate({
        type: "success",
        message: `✅ Snapshot: ${snapshot.collections.length} collections, ${
          snapshot.fields?.length || 0
        } fields`,
      });
    } catch (error: any) {
      logError("Schema Snapshot", error);
      onStatusUpdate({
        type: "error",
        message: `❌ Snapshot failed: ${error.message}`,
      });
      setSchemaMigrationStep("idle");
    } finally {
      setLoading("schema_snapshot", false);
    }
  };

  const handleSchemaDiff = async () => {
    if (!schemaSnapshot) return;

    setSchemaMigrationStep("diff");
    setLoading("schema_diff", true);

    try {
      const { DirectusClient } = await import("../lib/DirectusClient");
      const targetClient = new DirectusClient(targetUrl, targetToken);

      // Recursively remove systemFields from the entire payload
      const removeSystemFields = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map((item) => removeSystemFields(item));
        } else if (obj !== null && typeof obj === "object") {
          const { systemFields, ...rest } = obj;
          const cleaned: any = {};
          for (const key in rest) {
            cleaned[key] = removeSystemFields(rest[key]);
          }
          return cleaned;
        }
        return obj;
      };

      const cleanPayload = removeSystemFields(schemaSnapshot);

      const response = await targetClient.post(
        "/schema/diff?force=true",
        cleanPayload
      );
      const diffResult = response.data || response;

      if (!diffResult || !diffResult.diff || !diffResult.hash) {
        throw new Error("Invalid diff response");
      }

      setSchemaDiff(diffResult);

      const collectionsCount = diffResult.diff.collections?.length || 0;
      const fieldsCount = diffResult.diff.fields?.length || 0;
      const relationsCount = diffResult.diff.relations?.length || 0;
      const totalChanges = collectionsCount + fieldsCount + relationsCount;

      if (totalChanges === 0) {
        onStatusUpdate({
          type: "success",
          message: "✅ No differences found. Schemas are in sync!",
        });
        setSchemaMigrationStep("complete");
        return;
      }

      const allCollections = new Set<string>();

      diffResult.diff.collections?.forEach((col: any) => {
        if (col.collection) allCollections.add(col.collection);
      });

      diffResult.diff.fields?.forEach((field: any) => {
        if (field.collection) allCollections.add(field.collection);
      });

      diffResult.diff.relations?.forEach((rel: any) => {
        if (rel.collection) allCollections.add(rel.collection);
      });

      setSelectedSchemaCollections(Array.from(allCollections));

      onStatusUpdate({
        type: "info",
        message: `✅ Found changes: ${collectionsCount} collections, ${fieldsCount} fields, ${relationsCount} relations`,
      });
      setSchemaMigrationStep("apply");
    } catch (error: any) {
      logError("Schema Diff", error);

      const errorMessage = error.message || "";
      const isPayloadTooLarge =
        errorMessage.toLowerCase().includes("too large") ||
        errorMessage.toLowerCase().includes("entity too large") ||
        error.response?.data?.errors?.[0]?.extensions?.reason
          ?.toLowerCase()
          .includes("too large");

      if (isPayloadTooLarge) {
        onStatusUpdate({
          type: "error",
          message: `Schema is too large for direct comparison. Please try: 1) Increase target server's request size limit, 2) Use Directus CLI for large schemas, or 3) Migrate collections in smaller batches.`,
        });
      } else {
        onStatusUpdate({
          type: "error",
          message: `Failed to compare schemas: ${error.message}`,
        });
      }

      setSchemaMigrationStep("idle");
    } finally {
      setLoading("schema_diff", false);
    }
  };

  const handleSchemaApply = async () => {
    if (!schemaDiff || !schemaDiff.hash) {
      onStatusUpdate({
        type: "error",
        message: "❌ No diff data. Please run Compare Schemas first.",
      });
      return;
    }

    if (selectedSchemaCollections.length === 0) {
      onStatusUpdate({
        type: "warning",
        message:
          "⚠️ No collections selected. Please check the collections you want to migrate.",
      });
      return;
    }

    setSchemaMigrationStep("apply");
    setLoading("schema_apply", true);

    try {
      const { DirectusClient } = await import("../lib/DirectusClient");
      const targetClient = new DirectusClient(targetUrl, targetToken);

      const selectedSet = new Set(selectedSchemaCollections);

      const filteredCollections = (schemaDiff.diff.collections || []).filter(
        (col: any) => {
          if (!col.collection) return false;
          const isSelected = selectedSet.has(col.collection);
          if (col.collection.startsWith("directus_") && !showSystemCollections)
            return false;

          return isSelected;
        }
      );

      const filteredFields = (schemaDiff.diff.fields || []).filter(
        (fieldItem: any) => {
          if (!fieldItem.collection) {
            return false;
          }

          const isSelected = selectedSet.has(fieldItem.collection);

          if (
            fieldItem.collection.startsWith("directus_") &&
            !showSystemCollections
          ) {
            return false;
          }

          return isSelected;
        }
      );

      const filteredRelations = (schemaDiff.diff.relations || []).filter(
        (relItem: any) => {
          const involvedCollections = new Set<string>();

          if (relItem.collection) involvedCollections.add(relItem.collection);

          if (relItem.related_collection)
            involvedCollections.add(relItem.related_collection);

          if (relItem.meta?.one_collection)
            involvedCollections.add(relItem.meta.one_collection);
          if (relItem.meta?.many_collection)
            involvedCollections.add(relItem.meta.many_collection);

          if (relItem.meta?.junction_field) {
            const junctionCollection = relItem.collection;
            if (junctionCollection) involvedCollections.add(junctionCollection);
          }

          const shouldInclude = Array.from(involvedCollections).some((col) => {
            if (col.startsWith("directus_") && !showSystemCollections)
              return false;
            return selectedSet.has(col);
          });

          return shouldInclude;
        }
      );

      const validFilteredCollections = filteredCollections.filter(
        (col: any) => {
          if (!col.diff || !Array.isArray(col.diff) || col.diff.length === 0) {
            return false;
          }
          const hasRealChanges = col.diff.some((d: any) =>
            ["N", "E", "D"].includes(d.kind)
          );
          return hasRealChanges;
        }
      );

      const validFilteredFields = filteredFields.filter((field: any) => {
        if (
          !field.diff ||
          !Array.isArray(field.diff) ||
          field.diff.length === 0
        ) {
          return false;
        }
        const hasRealChanges = field.diff.some((d: any) =>
          ["N", "E", "D"].includes(d.kind)
        );
        return hasRealChanges;
      });

      const validFilteredRelations = filteredRelations.filter((rel: any) => {
        if (!rel.diff || !Array.isArray(rel.diff) || rel.diff.length === 0) {
          return false;
        }
        const hasRealChanges = rel.diff.some((d: any) =>
          ["N", "E", "D"].includes(d.kind)
        );
        return hasRealChanges;
      });

      const collectionsToApply = schemaApplyIncludeCollections
        ? validFilteredCollections
        : [];
      const fieldsToApply = schemaApplyIncludeFields ? validFilteredFields : [];
      const relationsToApply = schemaApplyIncludeRelations
        ? validFilteredRelations
        : [];

      if (
        !schemaApplyIncludeCollections &&
        !schemaApplyIncludeFields &&
        !schemaApplyIncludeRelations
      ) {
        onStatusUpdate({
          type: "warning",
          message:
            "⚠️ Nothing to apply. Please enable at least one of: Collections, Fields, Relations.",
        });
        setSchemaMigrationStep("idle");
        setLoading("schema_apply", false);
        return;
      }

      const filteredDiff = {
        hash: schemaDiff.hash,
        diff: {
          collections: collectionsToApply,
          fields: fieldsToApply,
          relations: relationsToApply,
        },
      };

      if (
        collectionsToApply.length === 0 &&
        fieldsToApply.length === 0 &&
        relationsToApply.length === 0
      ) {
        onStatusUpdate({
          type: "warning",
          message:
            "⚠️ No actual changes to apply for selected collections. All selected collections may already be in sync with the target.",
        });
        setSchemaMigrationStep("complete");
        return;
      }

      await targetClient.post("/schema/apply?force=true", filteredDiff);

      const collectionsCount = collectionsToApply.length;
      const fieldsCount = fieldsToApply.length;
      const relationsCount = relationsToApply.length;

      const migratedColNames = new Set(
        [
          ...collectionsToApply.map((col: any) => col.collection),
          ...fieldsToApply.map((field: any) => field.collection),
          ...relationsToApply.map((rel: any) => rel.collection),
        ].filter(Boolean)
      );
      setSchemaMigratedCollections((prev) => [
        ...new Set([...prev, ...Array.from(migratedColNames)]),
      ]);

      onStatusUpdate({
        type: "success",
        message: `✅ Schema applied successfully! ${collectionsCount} collection(s), ${fieldsCount} field(s), ${relationsCount} relation(s) migrated from ${selectedSchemaCollections.length} selected collection(s)`,
      });

      setSchemaMigrationStep("complete");
      await loadTargetCollections();
    } catch (error: any) {
      logError("Schema Apply", error);
      onStatusUpdate({
        type: "error",
        message: `❌ Apply failed: ${error.message}`,
      });
      setSchemaMigrationStep("idle");
    } finally {
      setLoading("schema_apply", false);
    }
  };

  const resetSchemaMigration = () => {
    setSchemaMigrationStep("idle");
    setSchemaSnapshot(null);
    setSchemaDiff(null);
    setSchemaMigratedCollections([]);
  };

  const analyzeSchemaChanges = (diffData: any, sourceSnapshot: any) => {
    const newCollections: any[] = [];
    const modifiedCollections: any[] = [];
    const deletedCollections: any[] = [];

    if (!diffData?.diff)
      return { newCollections, modifiedCollections, deletedCollections };

    const fieldsByCollection: Record<string, any[]> = {};

    (diffData.diff.fields || []).forEach((fieldItem: any) => {
      const collectionName = fieldItem.collection;
      if (!fieldsByCollection[collectionName]) {
        fieldsByCollection[collectionName] = [];
      }

      const diffArray = fieldItem.diff || [];
      let fieldAction = "update";
      let fieldData = null;
      const diffDetails: Array<{
        type: "info" | "change";
        message: string;
        path?: string;
        oldValue?: any;
        newValue?: any;
      }> = [];

      diffArray.forEach((diffItem: any) => {
        if (diffItem.kind === "N") {
          fieldAction = "create";
          fieldData = diffItem.rhs;
          diffDetails.push({
            type: "info",
            message: "NEW field - will be created in target",
          });
        } else if (diffItem.kind === "D") {
          fieldAction = "delete";
          fieldData = diffItem.lhs;
          diffDetails.push({
            type: "info",
            message: "DELETED field - exists in target but removed from source",
          });
        } else if (diffItem.kind === "E") {
          fieldAction = "update";
          fieldData = diffItem.rhs || fieldItem;

          const changePath = diffItem.path?.join(".") || "unknown";
          const oldValue = diffItem.lhs;
          const newValue = diffItem.rhs;

          if (diffItem.differences && Array.isArray(diffItem.differences)) {
            diffItem.differences.forEach((difference: any) => {
              if (typeof difference === "string") {
                diffDetails.push({
                  type: "change",
                  message: difference,
                  path: changePath,
                  oldValue,
                  newValue,
                });
              } else if (difference && typeof difference === "object") {
                diffDetails.push({
                  type: "change",
                  message: difference.message || JSON.stringify(difference),
                  path: difference.path || changePath,
                  oldValue: difference.oldValue ?? oldValue,
                  newValue: difference.newValue ?? newValue,
                });
              }
            });
          } else {
            diffDetails.push({
              type: "change",
              message: `${changePath}: ${JSON.stringify(
                oldValue
              )} → ${JSON.stringify(newValue)}`,
              path: changePath,
              oldValue,
              newValue,
            });
          }
        }
      });

      fieldsByCollection[collectionName].push({
        ...fieldItem,
        fieldName: fieldItem.field,
        action: fieldAction,
        data: fieldData,
        diffDetails,
      });
    });

    const relationsByCollection: Record<string, any[]> = {};
    (diffData.diff.relations || []).forEach((relationItem: any) => {
      const collectionName = relationItem.collection;
      if (!relationsByCollection[collectionName]) {
        relationsByCollection[collectionName] = [];
      }

      const diffArray = relationItem.diff || [];
      let relationAction = "update";
      const relationDiffDetails: Array<{
        type: "info" | "change";
        message: string;
        path?: string;
        oldValue?: any;
        newValue?: any;
      }> = [];

      diffArray.forEach((diffItem: any) => {
        if (diffItem.kind === "N") {
          relationAction = "create";
          relationDiffDetails.push({
            type: "info",
            message: "NEW relation - will be created in target",
          });
        } else if (diffItem.kind === "D") {
          relationAction = "delete";
          relationDiffDetails.push({
            type: "info",
            message:
              "DELETED relation - exists in target but removed from source",
          });
        } else if (diffItem.kind === "E") {
          relationAction = "update";
          const changePath = diffItem.path?.join(".") || "unknown";
          const oldValue = diffItem.lhs;
          const newValue = diffItem.rhs;

          if (diffItem.differences && Array.isArray(diffItem.differences)) {
            diffItem.differences.forEach((difference: any) => {
              if (typeof difference === "string") {
                relationDiffDetails.push({
                  type: "change",
                  message: difference,
                  path: changePath,
                  oldValue,
                  newValue,
                });
              } else if (difference && typeof difference === "object") {
                relationDiffDetails.push({
                  type: "change",
                  message: difference.message || JSON.stringify(difference),
                  path: difference.path || changePath,
                  oldValue: difference.oldValue ?? oldValue,
                  newValue: difference.newValue ?? newValue,
                });
              }
            });
          } else {
            relationDiffDetails.push({
              type: "change",
              message: `${changePath}: ${JSON.stringify(
                oldValue
              )} → ${JSON.stringify(newValue)}`,
              path: changePath,
              oldValue,
              newValue,
            });
          }
        }
      });

      relationsByCollection[collectionName].push({
        ...relationItem,
        action: relationAction,
        diffDetails: relationDiffDetails,
      });
    });

    const allCollectionsInDiff = new Set<string>();
    Object.keys(fieldsByCollection).forEach((name) =>
      allCollectionsInDiff.add(name)
    );
    Object.keys(relationsByCollection).forEach((name) =>
      allCollectionsInDiff.add(name)
    );

    const processedCollections = new Set<string>();

    (diffData.diff.collections || []).forEach((colItem: any) => {
      const collectionName = colItem.collection;
      if (!collectionName) return;

      processedCollections.add(collectionName);

      const diffArray = colItem.diff || [];
      let collectionAction = "update";
      let collectionData = null;
      const metadataDiffDetails: Array<{
        type: "info" | "change";
        message: string;
        path?: string;
        oldValue?: any;
        newValue?: any;
      }> = [];

      diffArray.forEach((diffItem: any) => {
        if (diffItem.kind === "N") {
          collectionAction = "create";
          collectionData = diffItem.rhs;
          metadataDiffDetails.push({
            type: "info",
            message: "NEW collection - will be created in target",
          });
        } else if (diffItem.kind === "D") {
          collectionAction = "delete";
          collectionData = diffItem.lhs;
          metadataDiffDetails.push({
            type: "info",
            message:
              "DELETED collection - exists in target but removed from source",
          });
        } else if (diffItem.kind === "E") {
          collectionAction = "update";
          collectionData = diffItem.rhs;

          const changePath = diffItem.path?.join(".") || "metadata";
          const oldValue = diffItem.lhs;
          const newValue = diffItem.rhs;

          if (diffItem.differences && Array.isArray(diffItem.differences)) {
            diffItem.differences.forEach((difference: any) => {
              if (typeof difference === "string") {
                metadataDiffDetails.push({
                  type: "change",
                  message: difference,
                  path: changePath,
                  oldValue,
                  newValue,
                });
              } else if (difference && typeof difference === "object") {
                metadataDiffDetails.push({
                  type: "change",
                  message: difference.message || JSON.stringify(difference),
                  path: difference.path || changePath,
                  oldValue: difference.oldValue ?? oldValue,
                  newValue: difference.newValue ?? newValue,
                });
              }
            });
          } else {
            metadataDiffDetails.push({
              type: "change",
              message: `${changePath}: ${JSON.stringify(
                oldValue
              )} → ${JSON.stringify(newValue)}`,
              path: changePath,
              oldValue,
              newValue,
            });
          }
        }
      });

      const collectionFields = fieldsByCollection[collectionName] || [];
      const collectionRelations = relationsByCollection[collectionName] || [];

      if (collectionAction === "create") {
        newCollections.push({
          ...colItem,
          collection: collectionName,
          action: collectionAction,
          data: collectionData,
          fields: collectionFields,
          relations: collectionRelations,
          fieldChanges: collectionFields
            .filter((f: any) => f.action === "create")
            .map((f: any) => ({
              field: f.fieldName,
              action: f.action,
              type: f.data?.type,
              validation: f.data?.meta?.validation,
              meta: f.data?.meta,
              schema: f.data?.schema,
              diffDetails: f.diffDetails,
              constraints: f.data?.schema
                ? {
                    nullable: f.data.schema.is_nullable,
                    unique: f.data.schema.is_unique,
                    primaryKey: f.data.schema.is_primary_key,
                    defaultValue: f.data.schema.default_value,
                    maxLength: f.data.schema.max_length,
                  }
                : null,
            })),
          metadataDiffDetails,
        });
      } else if (collectionAction === "delete") {
        deletedCollections.push({
          ...colItem,
          collection: collectionName,
          action: collectionAction,
          data: collectionData,
          metadataDiffDetails,
        });
      } else {
        const newFields = collectionFields.filter(
          (f: any) => f.action === "create"
        );
        const deletedFields = collectionFields.filter(
          (f: any) => f.action === "delete"
        );
        const modifiedFields = collectionFields.filter(
          (f: any) => f.action === "update"
        );

        // Check if collection itself has changes (metadata, icon, note, etc.)
        const hasCollectionMetadataChanges =
          diffArray.length > 0 &&
          diffArray.some((d: any) => ["N", "E", "D"].includes(d.kind));

        // Include if: has field changes OR relation changes OR collection metadata changes
        if (
          newFields.length > 0 ||
          deletedFields.length > 0 ||
          modifiedFields.length > 0 ||
          collectionRelations.length > 0 ||
          hasCollectionMetadataChanges
        ) {
          modifiedCollections.push({
            ...colItem,
            collection: collectionName,
            action: collectionAction,
            data: collectionData,
            fields: collectionFields,
            relations: collectionRelations,
            diff: diffArray,
            hasMetadataChanges: hasCollectionMetadataChanges,
            fieldChanges: collectionFields.map((f: any) => ({
              field: f.fieldName,
              action: f.action,
              type: f.data?.type,
              validation: f.data?.meta?.validation,
              meta: f.data?.meta,
              schema: f.data?.schema,
              diffDetails: f.diffDetails,
              constraints: f.data?.schema
                ? {
                    nullable: f.data.schema.is_nullable,
                    unique: f.data.schema.is_unique,
                    primaryKey: f.data.schema.is_primary_key,
                    defaultValue: f.data.schema.default_value,
                    maxLength: f.data.schema.max_length,
                  }
                : null,
            })),
            metadataDiffDetails,
            newFieldsCount: newFields.length,
            deletedFieldsCount: deletedFields.length,
            modifiedFieldsCount: modifiedFields.length,
          });
        }
      }
    });

    allCollectionsInDiff.forEach((collectionName: string) => {
      if (processedCollections.has(collectionName)) return;

      const collectionFields = fieldsByCollection[collectionName] || [];
      const collectionRelations = relationsByCollection[collectionName] || [];

      if (collectionFields.length > 0 || collectionRelations.length > 0) {
        const newFields = collectionFields.filter(
          (f: any) => f.action === "create"
        );
        const deletedFields = collectionFields.filter(
          (f: any) => f.action === "delete"
        );
        const modifiedFields = collectionFields.filter(
          (f: any) => f.action === "update"
        );

        modifiedCollections.push({
          collection: collectionName,
          action: "update",
          data: null,
          fields: collectionFields,
          relations: collectionRelations,
          fieldChanges: collectionFields.map((f: any) => ({
            field: f.fieldName,
            action: f.action,
            type: f.data?.type,
            validation: f.data?.meta?.validation,
            meta: f.data?.meta,
            schema: f.data?.schema,
            diffDetails: f.diffDetails,
            constraints: f.data?.schema
              ? {
                  nullable: f.data.schema.is_nullable,
                  unique: f.data.schema.is_unique,
                  primaryKey: f.data.schema.is_primary_key,
                  defaultValue: f.data.schema.default_value,
                  maxLength: f.data.schema.max_length,
                }
              : null,
          })),
          metadataDiffDetails: [],
          newFieldsCount: newFields.length,
          deletedFieldsCount: deletedFields.length,
          modifiedFieldsCount: modifiedFields.length,
        });
      }
    });

    return { newCollections, modifiedCollections, deletedCollections };
  };

  const logError = (operation: string, error: any) => {
    const category: "schema" | "data" = operation.toLowerCase().includes("schema") ? "schema" : "data";
    const errorLog = {
      id: Date.now().toString(),
      timestamp:
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " GMT+7",
      operation,
      category,
      error: {
        message: error.message || "Unknown error",
        status: error.response?.status || error.status || "N/A",
        statusText: error.response?.statusText || error.statusText || "N/A",
        data: error.response?.data || error.data || null,
        stack: error.stack || null,
      },
    };

    setErrorLogs((prev) => [errorLog, ...prev].slice(0, 50));
  };

  const handlePreviewItems = async (collectionName: string) => {
    setCurrentPreviewCollection(collectionName);
    setPreviewItems([]);
    setPreviewTotal(0);
    setSelectedItemIds([]);
    setLoadingPreview(true);
    setShowItemSelector(true);

    try {
      const result = await previewCollectionItems(
        sourceUrl,
        sourceToken,
        collectionName,
        { limit: -1, offset: 0 }
      );

      if (result.success) {
        setPreviewItems(result.items || []);
        setPreviewTotal(result.total || 0);
        onStatusUpdate({
          type: "success",
          message: `Loaded ${
            result.items?.length || 0
          } items from ${collectionName}`,
        });
      } else {
        onStatusUpdate({
          type: "error",
          message: `Failed to preview items: ${
            result.error?.message || "Unknown error"
          }`,
        });
        setShowItemSelector(false);
      }
    } catch (error: any) {
      onStatusUpdate({
        type: "error",
        message: `Preview failed: ${error.message}`,
      });
      setShowItemSelector(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImportSingleton = async (collectionName: string) => {
    const loadingKey = `import_${collectionName}`;
    setLoading(loadingKey, true);
    onStatusUpdate(null);

    try {
      const result = await importFromDirectus(
        sourceUrl,
        sourceToken,
        targetUrl,
        targetToken,
        collectionName,
        {
          limit: 1, // Singleton only has 1 item
          onProgress: (current: number, total: number) => {
            setImportProgress((prev) => ({
              ...prev,
              [collectionName]: { current, total },
            }));
          },
        }
      );

      if (result.success) {
        const importedItems = result.importedItems || [];
        const successful = importedItems.filter(
          (item) => item.status !== "error"
        ).length;
        const failed = importedItems.filter(
          (item) => item.status === "error"
        ).length;

        onStatusUpdate({
          type: failed > 0 ? "warning" : "success",
          message: `Singleton ${collectionName} imported: ${
            successful > 0 ? "Updated" : "Failed"
          }`,
        });

        if (!dataMigratedCollections.includes(collectionName)) {
          setDataMigratedCollections((prev) => [...prev, collectionName]);
        }
      } else {
        onStatusUpdate({
          type: "error",
          message:
            result.message || `Failed to import singleton ${collectionName}`,
        });
      }
    } catch (error: any) {
      onStatusUpdate({
        type: "error",
        message: `Import failed: ${error.message}`,
      });
      logError(`import_${collectionName}`, error);
    } finally {
      setLoading(loadingKey, false);
      setTimeout(() => {
        setImportProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[collectionName];
          return newProgress;
        });
      }, 1000);
    }
  };

  const handleImportSelectedCollections = async () => {
    if (selectedCollections.length === 0) {
      onStatusUpdate({
        type: "warning",
        message: "Please select at least one collection to import",
      });
      return;
    }

    const collectionsToImport = selectedCollections.filter((colName) => {
      const collection = collections.find((c) => c.collection === colName);
      return collection && !collection.meta?.singleton;
    });

    if (collectionsToImport.length === 0) {
      onStatusUpdate({
        type: "warning",
        message:
          "No valid collections selected (singletons must be imported individually)",
      });
      return;
    }

    setLoading("batch_import", true);
    onStatusUpdate({
      type: "info",
      message: `Starting batch import of ${collectionsToImport.length} collections...`,
    });

    const batchResults: Record<
      string,
      {
        success: Array<{ id: string | number; action: string }>;
        failed: Array<{ id: string | number; error: string }>;
      }
    > = {};

    for (const collectionName of collectionsToImport) {
      const loadingKey = `import_${collectionName}`;
      setLoading(loadingKey, true);

      try {
        const result = await importFromDirectus(
          sourceUrl,
          sourceToken,
          targetUrl,
          targetToken,
          collectionName,
          {
            limit: importLimit || undefined,
            excludeRelationalFields,
            onProgress: (current: number, total: number) => {
              setImportProgress((prev) => ({
                ...prev,
                [collectionName]: { current, total },
              }));
            },
          }
        );

        const successItems = (result.importedItems || [])
          .filter((item) => item.status !== "error")
          .map((item) => ({
            id: item.originalId,
            action: item.action || "imported",
          }));

        const failedItems = (result.importedItems || [])
          .filter((item) => item.status === "error")
          .map((item) => ({
            id: item.originalId,
            error: item.error?.message || "Unknown error",
          }));

        batchResults[collectionName] = {
          success: successItems,
          failed: failedItems,
        };

        if (!dataMigratedCollections.includes(collectionName)) {
          setDataMigratedCollections((prev) => [...prev, collectionName]);
        }

        onStatusUpdate({
          type: failedItems.length > 0 ? "warning" : "success",
          message: `${collectionName}: ${successItems.length} succeeded, ${failedItems.length} failed`,
        });
      } catch (error: any) {
        batchResults[collectionName] = {
          success: [],
          failed: [{ id: "batch_error", error: error.message }],
        };
        logError(`import_${collectionName}`, error);
      } finally {
        setLoading(loadingKey, false);
      }
    }

    setImportResults(batchResults);
    setShowImportResults(true);
    setLoading("batch_import", false);

    const totalSuccess = Object.values(batchResults).reduce(
      (sum, r) => sum + r.success.length,
      0
    );
    const totalFailed = Object.values(batchResults).reduce(
      (sum, r) => sum + r.failed.length,
      0
    );

    onStatusUpdate({
      type: totalFailed > 0 ? "warning" : "success",
      message: `✅ Batch import complete: ${totalSuccess} records succeeded, ${totalFailed} failed across ${collectionsToImport.length} collections`,
    });

    setTimeout(() => {
      setImportProgress({});
    }, 2000);
  };

  const handleImportSelected = async (selectedFields?: string[]) => {
    const collectionName = currentPreviewCollection;
    const loadingKey = `import_selected_${collectionName}`;
    setLoading(loadingKey, true);
    // Don't close modal immediately - keep it open to show progress
    // setShowItemSelector(false)
    onStatusUpdate(null);
    setImportProgress((prev) => ({
      ...prev,
      [collectionName]: { current: 0, total: selectedItemIds.length },
    }));

    try {
      const result = await importSelectedItems(
        sourceUrl,
        sourceToken,
        targetUrl,
        targetToken,
        collectionName,
        selectedItemIds,
        {
          selectedFields: selectedFields,
          onProgress: (current: number, total: number) => {
            setImportProgress((prev) => ({
              ...prev,
              [collectionName]: { current, total },
            }));
          },
        }
      );

      if (result.success) {
        const importedItems = result.importedItems || [];
        const successful = importedItems.filter(
          (item) => item.status !== "error"
        ).length;
        const failed = importedItems.filter(
          (item) => item.status === "error"
        ).length;
        const created = importedItems.filter(
          (item) => item.action === "created"
        ).length;
        const updated = importedItems.filter(
          (item) => item.action === "updated"
        ).length;

        const successItems = importedItems
          .filter((item) => item.status !== "error")
          .map((item) => ({
            id: item.originalId,
            action: item.action || "imported",
          }));
 
        const failedItems = importedItems
          .filter((item) => item.status === "error")
          .map((item) => ({
            id: item.originalId,
            error: item.error?.message || "Unknown error",
          }));
 
        setImportResults((prev) => {
          const prevResult = prev[collectionName] || {
            success: [],
            failed: [],
          };
          return {
            ...prev,
            [collectionName]: {
              success: [...prevResult.success, ...successItems],
              failed: [...prevResult.failed, ...failedItems],
            },
          };
        });
 
        if (successItems.length + failedItems.length > 0) {
          setShowImportResults(true);
        }
 
        if (!dataMigratedCollections.includes(collectionName)) {
          setDataMigratedCollections((prev) => [...prev, collectionName]);
        }

        onStatusUpdate({
          type: failed > 0 ? "warning" : "success",
          message: `Import complete for ${collectionName}: ${created} created, ${updated} updated, ${failed} failed`,
        });

        if (failed > 0) {
          const failedItems = importedItems.filter(
            (item) => item.status === "error"
          );
        }
      } else {
        onStatusUpdate({
          type: "error",
          message:
            result.message ||
            `Failed to import selected items from ${collectionName}`,
        });
      }
    } catch (error: any) {
      onStatusUpdate({
        type: "error",
        message: `Import failed: ${error.message}`,
      });
      logError(`import_selected_${collectionName}`, error);
    } finally {
      setLoading(loadingKey, false);
      setTimeout(() => {
        setImportProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[collectionName];
          return newProgress;
        });
      }, 1000);
    }
  };

  const handleImport = async (collectionName: string) => {
    const loadingKey = `import_${collectionName}`;
    setLoading(loadingKey, true);
    onStatusUpdate(null);
    setImportProgress((prev) => ({
      ...prev,
      [collectionName]: { current: 0, total: 0 },
    }));

    try {
      const result = await importFromDirectus(
        sourceUrl,
        sourceToken,
        targetUrl,
        targetToken,
        collectionName,
        {
          limit: importLimit || undefined,
          titleFilter: titleFilter.trim() || undefined,
          onProgress: (current: number, total: number) => {
            setImportProgress((prev) => ({
              ...prev,
              [collectionName]: { current, total },
            }));
          },
        }
      );

      if (result.success) {
        const importedItems = result.importedItems || [];
        const successful = importedItems.filter(
          (item) => item.status !== "error"
        ).length;
        const failed = importedItems.filter(
          (item) => item.status === "error"
        ).length;
        const created = importedItems.filter(
          (item) => item.action === "created"
        ).length;
        const updated = importedItems.filter(
          (item) => item.action === "updated"
        ).length;

        onStatusUpdate({
          type: failed > 0 ? "warning" : "success",
          message: `Import complete for ${collectionName}: ${created} created, ${updated} updated, ${failed} failed`,
        });

        if (failed > 0) {
          const failedItems = importedItems.filter(
            (item) => item.status === "error"
          );
        }
      } else {
        onStatusUpdate({
          type: "error",
          message: result.message || `Failed to import ${collectionName}`,
        });
      }
    } catch (error: any) {
      onStatusUpdate({
        type: "error",
        message: `Import failed: ${error.message}`,
      });
      logError(`import_collection_${collectionName}`, error);
    } finally {
      setLoading(loadingKey, false);
      setTimeout(() => {
        setImportProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[collectionName];
          return newProgress;
        });
      }, 1000);
    }
  };

  if (collections.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
        No collections found or none are accessible with the provided token.
      </div>
    );
  }

  const schemaErrorLogs = errorLogs.filter(log => log.category === "schema");
  const dataErrorLogs = errorLogs.filter(log => log.category === "data");

  return (
    <div>
      {/* Schema Migration Section */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#fef3c7",
          borderRadius: "8px",
          border: "2px solid #f59e0b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#92400e" }}>⚡ Schema Migration</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {schemaErrorLogs.length > 0 && (
              <button
                onClick={() => {setErrorLogCategory("schema"); setShowErrorLogs(true)}}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: "500",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
                title="View schema error logs"
              >
                🚨 Error Logs ({schemaErrorLogs.length})
              </button>
            )}
            <div
              style={{
                fontSize: "0.75rem",
                color: "#92400e",
                fontWeight: "500",
              }}
            >
              Critical: Run this before data migration
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: "1rem",
            fontSize: "0.875rem",
            color: "#78350f",
            lineHeight: "1.5",
          }}
        >
          Sync collection schemas, fields, and relationships from source to
          target environment. This ensures data migration will work correctly
          for new collections.
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Step 1: Snapshot */}
          <button
            onClick={handleSchemaSnapshot}
            disabled={
              loading.schema_snapshot || schemaMigrationStep === "complete"
            }
            style={{
              backgroundColor:
                schemaMigrationStep === "idle"
                  ? "#f59e0b"
                  : schemaMigrationStep === "snapshot"
                  ? "#d97706"
                  : "#10b981",
              color: "white",
              padding: "0.75rem 1rem",
              fontWeight: "500",
              borderRadius: "6px",
              border: "none",
              cursor: loading.schema_snapshot ? "not-allowed" : "pointer",
              opacity: loading.schema_snapshot ? 0.7 : 1,
              fontSize: "0.875rem",
            }}
          >
            {loading.schema_snapshot
              ? "📸 Getting Snapshot..."
              : schemaMigrationStep === "idle"
              ? "1️⃣ Get Schema Snapshot"
              : "✅ Snapshot Retrieved"}
          </button>

          {/* Step 2: Diff */}
          <button
            onClick={handleSchemaDiff}
            disabled={
              !schemaSnapshot ||
              loading.schema_diff ||
              schemaMigrationStep === "complete"
            }
            style={{
              backgroundColor:
                schemaMigrationStep === "diff" && !loading.schema_diff
                  ? "#f59e0b"
                  : schemaMigrationStep === "apply" ||
                    schemaMigrationStep === "complete"
                  ? "#10b981"
                  : "#9ca3af",
              color: "white",
              padding: "0.75rem 1rem",
              fontWeight: "500",
              borderRadius: "6px",
              border: "none",
              cursor:
                !schemaSnapshot || loading.schema_diff
                  ? "not-allowed"
                  : "pointer",
              opacity: !schemaSnapshot || loading.schema_diff ? 0.7 : 1,
              fontSize: "0.875rem",
            }}
          >
            {loading.schema_diff
              ? "🔍 Comparing..."
              : schemaMigrationStep === "diff"
              ? "2️⃣ Compare Schemas"
              : schemaMigrationStep === "apply" ||
                schemaMigrationStep === "complete"
              ? "✅ Differences Found"
              : "2️⃣ Compare Schemas"}
          </button>

          {/* Step 3: Apply */}
          <button
            onClick={() => {
              if (selectedSchemaCollections.length === 0) {
                onStatusUpdate({
                  type: "error",
                  message:
                    "⚠️ Please select at least one collection to migrate",
                });
                return;
              }

              const hasSystemCollections = selectedSchemaCollections.some(
                (col) => col.startsWith("directus_")
              );
              if (
                hasSystemCollections &&
                !confirm(
                  `⚠️ WARNING: You are about to migrate ${
                    selectedSchemaCollections.filter((c) =>
                      c.startsWith("directus_")
                    ).length
                  } system collection(s).\n\n` +
                    `This can affect core Directus functionality. Are you sure you want to proceed?`
                )
              ) {
                return;
              }

              handleSchemaApply();
            }}
            disabled={
              !schemaDiff ||
              loading.schema_apply ||
              schemaMigrationStep === "complete" ||
              selectedSchemaCollections.length === 0
            }
            style={{
              backgroundColor:
                schemaMigrationStep === "apply" &&
                !loading.schema_apply &&
                selectedSchemaCollections.length > 0
                  ? "#dc2626"
                  : schemaMigrationStep === "complete"
                  ? "#10b981"
                  : "#9ca3af",
              color: "white",
              padding: "0.75rem 1rem",
              fontWeight: "500",
              borderRadius: "6px",
              border: "none",
              cursor:
                !schemaDiff ||
                loading.schema_apply ||
                selectedSchemaCollections.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity:
                !schemaDiff ||
                loading.schema_apply ||
                selectedSchemaCollections.length === 0
                  ? 0.7
                  : 1,
              fontSize: "0.875rem",
            }}
            title={
              selectedSchemaCollections.length === 0
                ? "Please select collections first"
                : `Apply ${selectedSchemaCollections.length} selected collection(s)`
            }
          >
            {loading.schema_apply
              ? "⚡ Applying Changes..."
              : schemaMigrationStep === "apply"
              ? `3️⃣ Apply to Target`
              : schemaMigrationStep === "complete"
              ? "✅ Migration Complete"
              : `3️⃣ Apply to Target`}
          </button>

          {/* Reset Button */}
          {schemaMigrationStep !== "idle" && (
            <button
              onClick={resetSchemaMigration}
              disabled={Object.values(loading).some(Boolean)}
              style={{
                backgroundColor: "#6b7280",
                color: "white",
                padding: "0.5rem 0.75rem",
                fontWeight: "500",
                borderRadius: "6px",
                border: "none",
                cursor: Object.values(loading).some(Boolean)
                  ? "not-allowed"
                  : "pointer",
                fontSize: "0.75rem",
              }}
            >
              🔄 Reset
            </button>
          )}
        </div>

        {/* Detailed Schema Diff Viewer */}
        {schemaDiff &&
          schemaMigrationStep === "apply" &&
          !loading.schema_apply &&
          (() => {
            const { newCollections, modifiedCollections, deletedCollections } =
              analyzeSchemaChanges(schemaDiff, schemaSnapshot);

            const filterTerm = schemaCollectionFilter.toLowerCase().trim();

            const filteredNewCollections = newCollections.filter((col: any) => {
              const matchesSearch = col.collection
                .toLowerCase()
                .includes(filterTerm);
              const isSystemCollection = col.collection.startsWith("directus_");
              const shouldShow = showSystemCollections || !isSystemCollection;
              return matchesSearch && shouldShow;
            });

            const filteredModifiedCollections = modifiedCollections.filter(
              (col: any) =>
                col.collection.toLowerCase().includes(filterTerm) &&
                (showSystemCollections ||
                  !col.collection.startsWith("directus_"))
            );
            const filteredDeletedCollections = deletedCollections.filter(
              (col: any) =>
                col.collection.toLowerCase().includes(filterTerm) &&
                (showSystemCollections ||
                  !col.collection.startsWith("directus_"))
            );

            const paginate = (
              items: any[],
              page: number,
              pageSize: number
            ) => {
              const total = items.length;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              const safePage = Math.min(Math.max(page, 1), totalPages);
              const start = (safePage - 1) * pageSize;
              return {
                pageItems: items.slice(start, start + pageSize),
                total,
                totalPages,
                currentPage: safePage,
              };
            };

            const visibleNew =
              schemaChangeFilter === "all" || schemaChangeFilter === "new"
                ? paginate(filteredNewCollections, schemaPageNew, schemaPageSize)
                : { pageItems: [], total: 0, totalPages: 1, currentPage: 1 };
            const visibleModified =
              schemaChangeFilter === "all" || schemaChangeFilter === "modified"
                ? paginate(
                    filteredModifiedCollections,
                    schemaPageModified,
                    schemaPageSize
                  )
                : { pageItems: [], total: 0, totalPages: 1, currentPage: 1 };
            const visibleDeleted =
              schemaChangeFilter === "all" || schemaChangeFilter === "deleted"
                ? paginate(
                    filteredDeletedCollections,
                    schemaPageDeleted,
                    schemaPageSize
                  )
                : { pageItems: [], total: 0, totalPages: 1, currentPage: 1 };

            const totalCollections =
              newCollections.length +
              modifiedCollections.length +
              deletedCollections.length;
            const filteredTotal =
              filteredNewCollections.length +
              filteredModifiedCollections.length +
              filteredDeletedCollections.length;

            const systemCollectionsCount = [
              ...newCollections.filter((c: any) =>
                c.collection.startsWith("directus_")
              ),
              ...modifiedCollections.filter((c: any) =>
                c.collection.startsWith("directus_")
              ),
              ...deletedCollections.filter((c: any) =>
                c.collection.startsWith("directus_")
              ),
            ].length;

            const selectedSet = new Set(selectedSchemaCollections);
            const collectionsToApply = [
              ...newCollections,
              ...modifiedCollections,
              ...deletedCollections,
            ].filter((col: any) => {
              if (!selectedSet.has(col.collection)) return false;

              // New or deleted collections always have changes
              if (col.action === "create" || col.action === "delete")
                return true;

              // Check for collection metadata changes (icon, note, sort, etc.)
              const hasCollectionMetadataChanges =
                col.hasMetadataChanges ||
                (col.diff &&
                  Array.isArray(col.diff) &&
                  col.diff.length > 0 &&
                  col.diff.some((d: any) => ["N", "E", "D"].includes(d.kind)));

              // Check for field changes
              const hasFieldChanges =
                (col.newFieldsCount && col.newFieldsCount > 0) ||
                (col.deletedFieldsCount && col.deletedFieldsCount > 0) ||
                (col.modifiedFieldsCount && col.modifiedFieldsCount > 0) ||
                (col.fields && col.fields.length > 0);

              // Check for relation changes
              const hasRelationChanges =
                col.relations && col.relations.length > 0;

              // Include if ANY type of change exists
              return (
                hasCollectionMetadataChanges ||
                hasFieldChanges ||
                hasRelationChanges
              );
            }).length;

            return (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "#fff7ed",
                  border: "2px solid #fb923c",
                  borderRadius: "8px",
                }}
              >
                {/* System Collections Warning */}
                {showSystemCollections && systemCollectionsCount > 0 && (
                  <div
                    style={{
                      padding: "0.75rem",
                      backgroundColor: "#fee2e2",
                      borderRadius: "6px",
                      border: "1px solid #fecaca",
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        color: "#dc2626",
                        marginBottom: "0.5rem",
                      }}
                    >
                      ⚠️ System Collections Warning:
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#dc2626",
                        lineHeight: "1.4",
                      }}
                    >
                      {systemCollectionsCount} system collection(s) detected in
                      schema diff. Migrating these can affect core Directus
                      functionality. Proceed with caution.
                    </div>
                  </div>
                )}

                {/* Migration Strategy Info */}
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#e0f2fe",
                    borderRadius: "6px",
                    border: "1px solid #0284c7",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      color: "#075985",
                      marginBottom: "0.5rem",
                    }}
                  >
                    🎯 Migration Strategy - Select What to Apply:
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#0c4a6e",
                      lineHeight: "1.5",
                    }}
                  >
                    ✓ Check the collections you want to migrate to target
                    environment
                    <br />
                    ✓ Only checked collections will be applied when you click
                    "Apply to Target"
                    <br />
                    ✓ You can select individual collections or use "Select All"
                    / "Clear" buttons
                    <br />
                    {selectedSchemaCollections.length > 0 ? (
                      <span style={{ fontWeight: "600", color: "#0284c7" }}>
                        ✓ Currently selected: {selectedSchemaCollections.length}{" "}
                        collection(s) - {collectionsToApply} with actual changes
                        ready to apply
                      </span>
                    ) : (
                      <span style={{ fontWeight: "600", color: "#dc2626" }}>
                        ⚠️ No collections selected - please select at least one
                        collection to migrate
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <h4 style={{ margin: 0, color: "#9a3412", fontSize: "1rem" }}>
                    📊 Schema Differences: {totalCollections} collection(s) (
                    {selectedSchemaCollections.length} checked,{" "}
                    {collectionsToApply} with changes)
                    {filterTerm && ` - Showing ${filteredTotal} matching`}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Search box */}
                    <input
                      type="text"
                      placeholder="🔍 Search collections..."
                      value={schemaCollectionFilter}
                      onChange={(e) =>
                        setSchemaCollectionFilter(e.target.value)
                      }
                      style={{
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.75rem",
                        border: "1px solid #fb923c",
                        borderRadius: "4px",
                        minWidth: "200px",
                        outline: "none",
                      }}
                    />
                    {/* Filter by change type */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.25rem",
                        alignItems: "center",
                        fontSize: "0.7rem",
                        color: "#92400e",
                      }}
                    >
                      <span>Filter:</span>
                      {[
                        { key: "all", label: "All" },
                        { key: "new", label: "New" },
                        { key: "modified", label: "Modified" },
                        { key: "deleted", label: "Deleted" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setSchemaChangeFilter(
                              opt.key as "all" | "new" | "modified" | "deleted"
                            );
                            setSchemaPageNew(1);
                            setSchemaPageModified(1);
                            setSchemaPageDeleted(1);
                          }}
                          style={{
                            padding: "0.15rem 0.5rem",
                            fontSize: "0.7rem",
                            borderRadius: "9999px",
                            border:
                              schemaChangeFilter === opt.key
                                ? "1px solid #c2410c"
                                : "1px solid #fed7aa",
                            backgroundColor:
                              schemaChangeFilter === opt.key
                                ? "#fed7aa"
                                : "#fff7ed",
                            color:
                              schemaChangeFilter === opt.key
                                ? "#7c2d12"
                                : "#92400e",
                            cursor: "pointer",
                            fontWeight:
                              schemaChangeFilter === opt.key ? 700 : 500,
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Page size */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.7rem",
                        color: "#92400e",
                      }}
                    >
                      <span>Per page:</span>
                      <select
                        value={schemaPageSize}
                        onChange={(e) => {
                          const size = Number(e.target.value) || 10;
                          setSchemaPageSize(size);
                          setSchemaPageNew(1);
                          setSchemaPageModified(1);
                          setSchemaPageDeleted(1);
                        }}
                        style={{
                          padding: "0.15rem 0.4rem",
                          fontSize: "0.7rem",
                          borderRadius: "4px",
                          border: "1px solid #fb923c",
                          backgroundColor: "white",
                        }}
                      >
                        {[10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Apply scope */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.7rem",
                        color: "#92400e",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>Apply:</span>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <input
                          type="checkbox"
                          checked={schemaApplyIncludeCollections}
                          onChange={(e) =>
                            setSchemaApplyIncludeCollections(e.target.checked)
                          }
                        />
                        <span>Collections</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <input
                          type="checkbox"
                          checked={schemaApplyIncludeFields}
                          onChange={(e) =>
                            setSchemaApplyIncludeFields(e.target.checked)
                          }
                        />
                        <span>Fields</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <input
                          type="checkbox"
                          checked={schemaApplyIncludeRelations}
                          onChange={(e) =>
                            setSchemaApplyIncludeRelations(e.target.checked)
                          }
                        />
                        <span>Relations</span>
                      </label>
                    </div>

                    {/* Toggle System Collections */}
                    <button
                      onClick={() => {
                        const newState = !showSystemCollections;
                        setShowSystemCollections(newState);
                      }}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        backgroundColor: showSystemCollections
                          ? "#dc2626"
                          : "#f3f4f6",
                        color: showSystemCollections ? "white" : "#6b7280",
                        border: `1px solid ${
                          showSystemCollections ? "#dc2626" : "#d1d5db"
                        }`,
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                      title={
                        showSystemCollections
                          ? "Hide directus_* collections"
                          : "Show directus_* collections"
                      }
                    >
                      {showSystemCollections
                        ? "🔒 Hide System"
                        : "🔓 Show System"}
                    </button>
                    <button
                      onClick={() => {
                        const visibleCollections = [
                          ...visibleNew.pageItems.map(
                            (c: any) => c.collection
                          ),
                          ...visibleModified.pageItems.map(
                            (c: any) => c.collection
                          ),
                          ...visibleDeleted.pageItems.map(
                            (c: any) => c.collection
                          ),
                        ];
                        setSelectedSchemaCollections(visibleCollections);
                        onStatusUpdate({
                          type: "info",
                          message: `✓ Selected ${visibleCollections.length} visible collection(s)`,
                        });
                      }}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        backgroundColor: "#fb923c",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "500",
                      }}
                      title="Select all visible collections (based on current filter)"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        const previousCount = selectedSchemaCollections.length;
                        setSelectedSchemaCollections([]);
                        if (previousCount > 0) {
                          onStatusUpdate({
                            type: "info",
                            message: `✓ Cleared ${previousCount} selected collection(s)`,
                          });
                        }
                      }}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      title="Clear all selections"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* New Collections */}
                  {visibleNew.total > 0 && (
                    <div
                      style={{
                        backgroundColor: "#ecfdf5",
                        border: "2px solid #10b981",
                        borderRadius: "8px",
                        padding: "1rem",
                      }}
                    >
                      <h5
                        style={{
                          margin: "0 0 0.75rem 0",
                          color: "#065f46",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        ✨ New Collections ({visibleNew.total}
                        {filterTerm ? ` of ${newCollections.length}` : ""})
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "normal",
                            color: "#059669",
                          }}
                        >
                          - Will be created in target
                        </span>
                      </h5>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        {visibleNew.pageItems.map((col: any) => (
                          <div
                            key={col.collection}
                            style={{
                              backgroundColor: "white",
                              border: selectedSchemaCollections.includes(
                                col.collection
                              )
                                ? "2px solid #10b981"
                                : "1px solid #d1fae5",
                              borderRadius: "6px",
                              padding: "0.75rem",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.5rem",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSchemaCollections.includes(
                                  col.collection
                                )}
                                onChange={(e) => {
                                  handleCollectionSelection(
                                    col.collection,
                                    e.target.checked
                                  );
                                }}
                                style={{
                                  marginTop: "0.25rem",
                                  cursor: "pointer",
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "600",
                                      color: "#065f46",
                                    }}
                                  >
                                    {col.collection}
                                  </div>
                                  {selectedSchemaCollections.includes(
                                    col.collection
                                  ) && (
                                    <span
                                      style={{
                                        padding: "0.125rem 0.5rem",
                                        fontSize: "0.625rem",
                                        backgroundColor: "#10b981",
                                        color: "white",
                                        borderRadius: "9999px",
                                        fontWeight: "600",
                                      }}
                                    >
                                      ✓ SELECTED
                                    </span>
                                  )}
                                  {col.collection.startsWith("directus_") && (
                                    <span
                                      style={{
                                        padding: "0.125rem 0.5rem",
                                        fontSize: "0.625rem",
                                        backgroundColor: "#dc2626",
                                        color: "white",
                                        borderRadius: "9999px",
                                        fontWeight: "600",
                                      }}
                                    >
                                      SYSTEM
                                    </span>
                                  )}
                                </div>
                                {col.fields && col.fields.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#059669",
                                      marginTop: "0.5rem",
                                    }}
                                  >
                                    📝 {col.fields.length} field(s):{" "}
                                    {col.fields
                                      .map((f: any) => f.field)
                                      .join(", ")}
                                  </div>
                                )}
                                {col.relations && col.relations.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#059669",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    🔗 {col.relations.length} relation(s)
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}

                        {visibleNew.totalPages > 1 && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: "0.35rem",
                              fontSize: "0.7rem",
                              color: "#047857",
                            }}
                          >
                            <button
                              onClick={() =>
                                setSchemaPageNew(
                                  Math.max(1, visibleNew.currentPage - 1)
                                )
                              }
                              disabled={visibleNew.currentPage === 1}
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #6ee7b7",
                                backgroundColor:
                                  visibleNew.currentPage === 1
                                    ? "#ecfdf5"
                                    : "#d1fae5",
                                cursor:
                                  visibleNew.currentPage === 1
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ◀
                            </button>
                            <span>
                              Page {visibleNew.currentPage} /{" "}
                              {visibleNew.totalPages}
                            </span>
                            <button
                              onClick={() =>
                                setSchemaPageNew(
                                  Math.min(
                                    visibleNew.totalPages,
                                    visibleNew.currentPage + 1
                                  )
                                )
                              }
                              disabled={
                                visibleNew.currentPage === visibleNew.totalPages
                              }
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #6ee7b7",
                                backgroundColor:
                                  visibleNew.currentPage ===
                                  visibleNew.totalPages
                                    ? "#ecfdf5"
                                    : "#d1fae5",
                                cursor:
                                  visibleNew.currentPage ===
                                  visibleNew.totalPages
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Modified Collections */}
                  {visibleModified.total > 0 && (
                    <div
                      style={{
                        backgroundColor: "#fef3c7",
                        border: "2px solid #f59e0b",
                        borderRadius: "8px",
                        padding: "1rem",
                      }}
                    >
                      <h5
                        style={{
                          margin: "0 0 0.75rem 0",
                          color: "#92400e",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        🔄 Modified Collections ({visibleModified.total}
                        {filterTerm ? ` of ${modifiedCollections.length}` : ""})
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "normal",
                            color: "#d97706",
                          }}
                        >
                          - Have field or validation changes
                        </span>
                      </h5>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        {visibleModified.pageItems.map((col: any) => {
                          const isCollapsed =
                            collapsedFieldDetails[col.collection] ?? true;
                          const hasDetails =
                            (col.fieldChanges && col.fieldChanges.length > 0) ||
                            (col.metadataDiffDetails &&
                              col.metadataDiffDetails.length > 0) ||
                            (col.relations && col.relations.length > 0);

                          return (
                            <div
                              key={col.collection}
                              style={{
                                backgroundColor: "white",
                                border: selectedSchemaCollections.includes(
                                  col.collection
                                )
                                  ? "2px solid #f59e0b"
                                  : "1px solid #fde68a",
                                borderRadius: "6px",
                                padding: "0.75rem",
                              }}
                            >
                              {/* Header with checkbox and collection name */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "0.5rem",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSchemaCollections.includes(
                                    col.collection
                                  )}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleCollectionSelection(
                                      col.collection,
                                      e.target.checked
                                    );
                                  }}
                                  style={{
                                    marginTop: "0.25rem",
                                    cursor: "pointer",
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      marginBottom: "0.5rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: "600",
                                          color: "#92400e",
                                        }}
                                      >
                                        {col.collection}
                                      </div>
                                      {selectedSchemaCollections.includes(
                                        col.collection
                                      ) && (
                                        <span
                                          style={{
                                            padding: "0.125rem 0.5rem",
                                            fontSize: "0.625rem",
                                            backgroundColor: "#f59e0b",
                                            color: "white",
                                            borderRadius: "9999px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          ✓ SELECTED
                                        </span>
                                      )}
                                      {col.collection.startsWith(
                                        "directus_"
                                      ) && (
                                        <span
                                          style={{
                                            padding: "0.125rem 0.5rem",
                                            fontSize: "0.625rem",
                                            backgroundColor: "#dc2626",
                                            color: "white",
                                            borderRadius: "9999px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          SYSTEM
                                        </span>
                                      )}
                                    </div>
                                    {hasDetails && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCollapsedFieldDetails((prev) => ({
                                            ...prev,
                                            [col.collection]: !isCollapsed,
                                          }));
                                        }}
                                        style={{
                                          background: "none",
                                          border: "1px solid #d97706",
                                          borderRadius: "4px",
                                          padding: "0.25rem 0.5rem",
                                          cursor: "pointer",
                                          fontSize: "0.7rem",
                                          color: "#92400e",
                                          fontWeight: "600",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                        }}
                                      >
                                        {isCollapsed ? "▶" : "▼"}{" "}
                                        {isCollapsed ? "Show" : "Hide"} Details
                                      </button>
                                    )}
                                  </div>

                                  {/* Summary Badge */}
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "0.5rem",
                                      marginBottom:
                                        hasDetails && !isCollapsed
                                          ? "0.5rem"
                                          : "0",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {col.newFieldsCount > 0 && (
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "0.25rem 0.5rem",
                                          backgroundColor: "#dcfce7",
                                          color: "#166534",
                                          borderRadius: "4px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        ➕ {col.newFieldsCount} new field
                                        {col.newFieldsCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                    {col.deletedFieldsCount > 0 && (
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "0.25rem 0.5rem",
                                          backgroundColor: "#fee2e2",
                                          color: "#991b1b",
                                          borderRadius: "4px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        ➖ {col.deletedFieldsCount} deleted
                                        field
                                        {col.deletedFieldsCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                    {col.modifiedFieldsCount > 0 && (
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "0.25rem 0.5rem",
                                          backgroundColor: "#e0e7ff",
                                          color: "#3730a3",
                                          borderRadius: "4px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        ✏️ {col.modifiedFieldsCount} modified
                                        field
                                        {col.modifiedFieldsCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                    {col.relations &&
                                      col.relations.length > 0 && (
                                        <span
                                          style={{
                                            fontSize: "0.7rem",
                                            padding: "0.25rem 0.5rem",
                                            backgroundColor: "#fef3c7",
                                            color: "#92400e",
                                            borderRadius: "4px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          🔗 {col.relations.length} relation
                                          {col.relations.length > 1 ? "s" : ""}
                                        </span>
                                      )}
                                    {col.metadataDiffDetails &&
                                      col.metadataDiffDetails.length > 0 && (
                                        <span
                                          style={{
                                            fontSize: "0.7rem",
                                            padding: "0.25rem 0.5rem",
                                            backgroundColor: "#fee2e2",
                                            color: "#b45309",
                                            borderRadius: "4px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          🧱 metadata change
                                        </span>
                                      )}
                                  </div>

                                  {/* Collapsible Details */}
                                  {!isCollapsed && hasDetails && (
                                    <div
                                      style={{
                                        backgroundColor: "#fffbeb",
                                        padding: "0.75rem",
                                        borderRadius: "6px",
                                        marginTop: "0.75rem",
                                        border: "1px solid #fde68a",
                                      }}
                                    >
                                      {col.fieldChanges?.length > 0 && (
                                        <DetailSection
                                          icon="📝"
                                          title="Field Changes"
                                          accentColor="#92400e"
                                          borderColor="#fed7aa"
                                          backgroundColor="#fff7ed"
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            {col.fieldChanges.map(
                                              (field: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  style={{
                                                    fontSize: "0.75rem",
                                                    color: "#78350f",
                                                    lineHeight: "1.45",
                                                    padding: "0.6rem",
                                                    backgroundColor:
                                                      field.action === "create"
                                                        ? "#ecfdf5"
                                                        : field.action ===
                                                          "delete"
                                                        ? "#fef2f2"
                                                        : "#eef2ff",
                                                    borderLeft: `3px solid ${
                                                      field.action === "create"
                                                        ? "#10b981"
                                                        : field.action ===
                                                          "delete"
                                                        ? "#dc2626"
                                                        : "#6366f1"
                                                    }`,
                                                    borderRadius: "6px",
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "0.4rem",
                                                      marginBottom: "0.3rem",
                                                      flexWrap: "wrap",
                                                    }}
                                                  >
                                                    <strong
                                                      style={{
                                                        fontSize: "0.85rem",
                                                      }}
                                                    >
                                                      {field.field}
                                                    </strong>
                                                    <span
                                                      style={{
                                                        padding:
                                                          "0.15rem 0.4rem",
                                                        fontSize: "0.65rem",
                                                        borderRadius: "9999px",
                                                        backgroundColor:
                                                          field.action ===
                                                          "create"
                                                            ? "#dcfce7"
                                                            : field.action ===
                                                              "delete"
                                                            ? "#fee2e2"
                                                            : "#e0e7ff",
                                                        color:
                                                          field.action ===
                                                          "create"
                                                            ? "#15803d"
                                                            : field.action ===
                                                              "delete"
                                                            ? "#b91c1c"
                                                            : "#4338ca",
                                                        fontWeight: 600,
                                                      }}
                                                    >
                                                      {field.action === "create"
                                                        ? "NEW"
                                                        : field.action ===
                                                          "delete"
                                                        ? "DELETED"
                                                        : "UPDATED"}
                                                    </span>
                                                    {field.type && (
                                                      <span
                                                        style={{
                                                          fontSize: "0.7rem",
                                                          color: "#a16207",
                                                          fontWeight: 600,
                                                        }}
                                                      >
                                                        ({field.type})
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div
                                                    style={{
                                                      fontSize: "0.7rem",
                                                      color: "#6b7280",
                                                      fontStyle: "italic",
                                                      marginBottom: "0.35rem",
                                                    }}
                                                  >
                                                    {field.action ===
                                                      "create" &&
                                                      "📍 Field exists in source but not in target"}
                                                    {field.action ===
                                                      "delete" &&
                                                      "📍 Field exists in target but removed from source"}
                                                    {field.action ===
                                                      "update" &&
                                                      "📍 Field has different configuration between source and target"}
                                                  </div>
                                                  {field.action === "update" &&
                                                    field.diffDetails?.length >
                                                      0 && (
                                                      <div
                                                        style={{
                                                          backgroundColor:
                                                            "#fff7ed",
                                                          borderRadius: "4px",
                                                          border:
                                                            "1px dashed #fb923c",
                                                          padding: "0.45rem",
                                                          marginBottom:
                                                            "0.35rem",
                                                        }}
                                                      >
                                                        {field.diffDetails.map(
                                                          (
                                                            detail: any,
                                                            detailIdx: number
                                                          ) => (
                                                            <div
                                                              key={detailIdx}
                                                              style={{
                                                                marginBottom:
                                                                  detailIdx ===
                                                                  field
                                                                    .diffDetails
                                                                    .length -
                                                                    1
                                                                    ? 0
                                                                    : "0.3rem",
                                                              }}
                                                            >
                                                              <div
                                                                style={{
                                                                  fontSize:
                                                                    "0.65rem",
                                                                  fontWeight: 600,
                                                                  color:
                                                                    "#c2410c",
                                                                }}
                                                              >
                                                                {detail.message ||
                                                                  detail.path ||
                                                                  "Field change"}
                                                              </div>
                                                              {detail.oldValue !==
                                                                undefined &&
                                                              detail.newValue !==
                                                                undefined ? (
                                                                <div
                                                                  style={{
                                                                    fontSize:
                                                                      "0.65rem",
                                                                    color:
                                                                      "#92400e",
                                                                    display:
                                                                      "flex",
                                                                    flexWrap:
                                                                      "wrap",
                                                                    gap: "0.35rem",
                                                                    marginTop:
                                                                      "0.15rem",
                                                                  }}
                                                                >
                                                                  <span>
                                                                    <strong>
                                                                      from:
                                                                    </strong>{" "}
                                                                    {formatDiffValue(
                                                                      detail.oldValue
                                                                    )}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        "#ea580c",
                                                                    }}
                                                                  >
                                                                    →
                                                                  </span>
                                                                  <span>
                                                                    <strong>
                                                                      to:
                                                                    </strong>{" "}
                                                                    {formatDiffValue(
                                                                      detail.newValue
                                                                    )}
                                                                  </span>
                                                                </div>
                                                              ) : (
                                                                <div
                                                                  style={{
                                                                    fontSize:
                                                                      "0.65rem",
                                                                    color:
                                                                      "#92400e",
                                                                    marginTop:
                                                                      "0.15rem",
                                                                  }}
                                                                >
                                                                  {detail.path && (
                                                                    <strong>
                                                                      {
                                                                        detail.path
                                                                      }
                                                                      :{" "}
                                                                    </strong>
                                                                  )}
                                                                  {
                                                                    detail.message
                                                                  }
                                                                </div>
                                                              )}
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}
                                                  {field.validation && (
                                                    <div
                                                      style={{
                                                        color: "#b45309",
                                                        fontSize: "0.7rem",
                                                      }}
                                                    >
                                                      ✓ Validation:{" "}
                                                      {JSON.stringify(
                                                        field.validation
                                                      )}
                                                    </div>
                                                  )}
                                                  {field.constraints && (
                                                    <div
                                                      style={{
                                                        color: "#92400e",
                                                        fontSize: "0.7rem",
                                                        marginTop: "0.15rem",
                                                      }}
                                                    >
                                                      {field.constraints
                                                        .nullable !==
                                                        undefined &&
                                                        `Nullable: ${field.constraints.nullable}, `}
                                                      {field.constraints
                                                        .unique &&
                                                        `Unique: ${field.constraints.unique}, `}
                                                      {field.constraints
                                                        .primaryKey &&
                                                        `Primary Key: ${field.constraints.primaryKey}, `}
                                                      {field.constraints
                                                        .maxLength &&
                                                        `Max Length: ${field.constraints.maxLength}`}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </DetailSection>
                                      )}

                                      {col.metadataDiffDetails?.length > 0 && (
                                        <DetailSection
                                          icon="🧱"
                                          title="Collection Metadata Changes"
                                          accentColor="#b45309"
                                          borderColor="#fecdd3"
                                          backgroundColor="#fff1f2"
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "0.4rem",
                                            }}
                                          >
                                            {col.metadataDiffDetails.map(
                                              (detail: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  style={{
                                                    fontSize: "0.7rem",
                                                    color: "#9a3412",
                                                  }}
                                                >
                                                  <div
                                                    style={{ fontWeight: 600 }}
                                                  >
                                                    {detail.path || "metadata"}{" "}
                                                    - {detail.message}
                                                  </div>
                                                  {detail.oldValue !==
                                                    undefined &&
                                                    detail.newValue !==
                                                      undefined && (
                                                      <div
                                                        style={{
                                                          display: "flex",
                                                          flexWrap: "wrap",
                                                          gap: "0.35rem",
                                                          marginTop: "0.15rem",
                                                          fontSize: "0.65rem",
                                                        }}
                                                      >
                                                        <span>
                                                          <strong>from:</strong>{" "}
                                                          {formatDiffValue(
                                                            detail.oldValue
                                                          )}
                                                        </span>
                                                        <span
                                                          style={{
                                                            color: "#c2410c",
                                                          }}
                                                        >
                                                          →
                                                        </span>
                                                        <span>
                                                          <strong>to:</strong>{" "}
                                                          {formatDiffValue(
                                                            detail.newValue
                                                          )}
                                                        </span>
                                                      </div>
                                                    )}
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </DetailSection>
                                      )}

                                      {col.relations?.length > 0 && (
                                        <DetailSection
                                          icon="🔗"
                                          title="Relation Changes"
                                          accentColor="#3f6212"
                                          borderColor="#bef264"
                                          backgroundColor="#f7fee7"
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            {col.relations.map(
                                              (
                                                relation: any,
                                                relIdx: number
                                              ) => (
                                                <div
                                                  key={relIdx}
                                                  style={{
                                                    padding: "0.5rem",
                                                    backgroundColor: "#ecfccb",
                                                    borderRadius: "6px",
                                                    borderLeft: `3px solid ${
                                                      relation.action ===
                                                      "create"
                                                        ? "#65a30d"
                                                        : relation.action ===
                                                          "delete"
                                                        ? "#b91c1c"
                                                        : "#0f766e"
                                                    }`,
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "0.4rem",
                                                      fontWeight: 600,
                                                      color: "#365314",
                                                      flexWrap: "wrap",
                                                    }}
                                                  >
                                                    <span>
                                                      {relation.field ||
                                                        relation.meta
                                                          ?.many_field ||
                                                        relation.id ||
                                                        `Relation ${
                                                          relIdx + 1
                                                        }`}
                                                    </span>
                                                    <span
                                                      style={{
                                                        padding:
                                                          "0.125rem 0.4rem",
                                                        fontSize: "0.65rem",
                                                        borderRadius: "9999px",
                                                        backgroundColor:
                                                          relation.action ===
                                                          "create"
                                                            ? "#dcfce7"
                                                            : relation.action ===
                                                              "delete"
                                                            ? "#fee2e2"
                                                            : "#d9f99d",
                                                        color:
                                                          relation.action ===
                                                          "create"
                                                            ? "#15803d"
                                                            : relation.action ===
                                                              "delete"
                                                            ? "#b91c1c"
                                                            : "#4d7c0f",
                                                      }}
                                                    >
                                                      {relation.action ===
                                                      "create"
                                                        ? "NEW"
                                                        : relation.action ===
                                                          "delete"
                                                        ? "DELETED"
                                                        : "UPDATED"}
                                                    </span>
                                                  </div>
                                                  <div
                                                    style={{
                                                      fontSize: "0.7rem",
                                                      color: "#4d7c0f",
                                                      marginTop: "0.15rem",
                                                    }}
                                                  >
                                                    {relation.collection} ⇄{" "}
                                                    {relation.related_collection ||
                                                      relation.meta
                                                        ?.many_collection ||
                                                      relation.meta
                                                        ?.one_collection ||
                                                      "unknown"}
                                                  </div>
                                                  {relation.diffDetails
                                                    ?.length > 0 && (
                                                    <div
                                                      style={{
                                                        backgroundColor:
                                                          "#f0fdf4",
                                                        borderRadius: "4px",
                                                        padding: "0.4rem",
                                                        marginTop: "0.35rem",
                                                        fontSize: "0.65rem",
                                                        color: "#365314",
                                                      }}
                                                    >
                                                      {relation.diffDetails.map(
                                                        (
                                                          detail: any,
                                                          detailIdx: number
                                                        ) => (
                                                          <div
                                                            key={detailIdx}
                                                            style={{
                                                              marginBottom:
                                                                detailIdx ===
                                                                relation
                                                                  .diffDetails
                                                                  .length -
                                                                  1
                                                                  ? 0
                                                                  : "0.3rem",
                                                            }}
                                                          >
                                                            <div
                                                              style={{
                                                                fontWeight: 600,
                                                              }}
                                                            >
                                                              {detail.path ||
                                                                "relation"}{" "}
                                                              - {detail.message}
                                                            </div>
                                                            {detail.oldValue !==
                                                              undefined &&
                                                              detail.newValue !==
                                                                undefined && (
                                                                <div
                                                                  style={{
                                                                    display:
                                                                      "flex",
                                                                    flexWrap:
                                                                      "wrap",
                                                                    gap: "0.35rem",
                                                                    marginTop:
                                                                      "0.15rem",
                                                                  }}
                                                                >
                                                                  <span>
                                                                    <strong>
                                                                      from:
                                                                    </strong>{" "}
                                                                    {formatDiffValue(
                                                                      detail.oldValue
                                                                    )}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        "#15803d",
                                                                    }}
                                                                  >
                                                                    →
                                                                  </span>
                                                                  <span>
                                                                    <strong>
                                                                      to:
                                                                    </strong>{" "}
                                                                    {formatDiffValue(
                                                                      detail.newValue
                                                                    )}
                                                                  </span>
                                                                </div>
                                                              )}
                                                          </div>
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </DetailSection>
                                      )}
                                    </div>
                                  )}

                                  {/* Collection-level validation */}
                                  {!isCollapsed &&
                                    (col.schema?.validation ||
                                      col.meta?.validation) && (
                                      <div
                                        style={{
                                          backgroundColor: "#fef3c7",
                                          padding: "0.5rem",
                                          borderRadius: "4px",
                                          border: "1px solid #fcd34d",
                                          fontSize: "0.75rem",
                                          color: "#92400e",
                                          marginTop: "0.5rem",
                                        }}
                                      >
                                        <strong>Collection Validation:</strong>
                                        <pre
                                          style={{
                                            margin: "0.25rem 0 0 0",
                                            fontSize: "0.7rem",
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          {JSON.stringify(
                                            col.schema?.validation ||
                                              col.meta?.validation,
                                            null,
                                            2
                                          )}
                                        </pre>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {visibleModified.totalPages > 1 && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: "0.35rem",
                              fontSize: "0.7rem",
                              color: "#b45309",
                            }}
                          >
                            <button
                              onClick={() =>
                                setSchemaPageModified(
                                  Math.max(1, visibleModified.currentPage - 1)
                                )
                              }
                              disabled={visibleModified.currentPage === 1}
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #fed7aa",
                                backgroundColor:
                                  visibleModified.currentPage === 1
                                    ? "#fffbeb"
                                    : "#fef3c7",
                                cursor:
                                  visibleModified.currentPage === 1
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ◀
                            </button>
                            <span>
                              Page {visibleModified.currentPage} /{" "}
                              {visibleModified.totalPages}
                            </span>
                            <button
                              onClick={() =>
                                setSchemaPageModified(
                                  Math.min(
                                    visibleModified.totalPages,
                                    visibleModified.currentPage + 1
                                  )
                                )
                              }
                              disabled={
                                visibleModified.currentPage ===
                                visibleModified.totalPages
                              }
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #fed7aa",
                                backgroundColor:
                                  visibleModified.currentPage ===
                                  visibleModified.totalPages
                                    ? "#fffbeb"
                                    : "#fef3c7",
                                cursor:
                                  visibleModified.currentPage ===
                                  visibleModified.totalPages
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deleted Collections */}
                  {visibleDeleted.total > 0 && (
                    <div
                      style={{
                        backgroundColor: "#fee2e2",
                        border: "2px solid #dc2626",
                        borderRadius: "8px",
                        padding: "1rem",
                      }}
                    >
                      <h5
                        style={{
                          margin: "0 0 0.75rem 0",
                          color: "#991b1b",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        🗑️ Deleted Collections ({visibleDeleted.total}
                        {filterTerm ? ` of ${deletedCollections.length}` : ""})
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "normal",
                            color: "#dc2626",
                          }}
                        >
                          - Exist in target but removed from source
                        </span>
                      </h5>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        {visibleDeleted.pageItems.map((col: any) => (
                          <div
                            key={col.collection}
                            style={{
                              backgroundColor: "white",
                              border: selectedSchemaCollections.includes(
                                col.collection
                              )
                                ? "2px solid #dc2626"
                                : "1px solid #fecaca",
                              borderRadius: "6px",
                              padding: "0.75rem",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.5rem",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSchemaCollections.includes(
                                  col.collection
                                )}
                                onChange={(e) => {
                                  handleCollectionSelection(
                                    col.collection,
                                    e.target.checked
                                  );
                                }}
                                style={{
                                  marginTop: "0.25rem",
                                  cursor: "pointer",
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "600",
                                      color: "#991b1b",
                                    }}
                                  >
                                    {col.collection}
                                  </span>
                                  {selectedSchemaCollections.includes(
                                    col.collection
                                  ) && (
                                    <span
                                      style={{
                                        padding: "0.125rem 0.5rem",
                                        fontSize: "0.625rem",
                                        backgroundColor: "#dc2626",
                                        color: "white",
                                        borderRadius: "9999px",
                                        fontWeight: "600",
                                      }}
                                    >
                                      ✓ SELECTED
                                    </span>
                                  )}
                                  {col.collection.startsWith("directus_") && (
                                    <span
                                      style={{
                                        padding: "0.125rem 0.5rem",
                                        fontSize: "0.625rem",
                                        backgroundColor: "#dc2626",
                                        color: "white",
                                        borderRadius: "9999px",
                                        fontWeight: "600",
                                      }}
                                    >
                                      SYSTEM
                                    </span>
                                  )}
                                </div>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#dc2626",
                                  }}
                                >
                                  ⚠️ Will be deleted from target environment
                                </span>
                              </div>
                            </label>
                          </div>
                        ))}

                        {visibleDeleted.totalPages > 1 && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: "0.35rem",
                              fontSize: "0.7rem",
                              color: "#b91c1c",
                            }}
                          >
                            <button
                              onClick={() =>
                                setSchemaPageDeleted(
                                  Math.max(1, visibleDeleted.currentPage - 1)
                                )
                              }
                              disabled={visibleDeleted.currentPage === 1}
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #fecaca",
                                backgroundColor:
                                  visibleDeleted.currentPage === 1
                                    ? "#fee2e2"
                                    : "#fecaca",
                                cursor:
                                  visibleDeleted.currentPage === 1
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ◀
                            </button>
                            <span>
                              Page {visibleDeleted.currentPage} /{" "}
                              {visibleDeleted.totalPages}
                            </span>
                            <button
                              onClick={() =>
                                setSchemaPageDeleted(
                                  Math.min(
                                    visibleDeleted.totalPages,
                                    visibleDeleted.currentPage + 1
                                  )
                                )
                              }
                              disabled={
                                visibleDeleted.currentPage ===
                                visibleDeleted.totalPages
                              }
                              style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                border: "1px solid #fecaca",
                                backgroundColor:
                                  visibleDeleted.currentPage ===
                                  visibleDeleted.totalPages
                                    ? "#fee2e2"
                                    : "#fecaca",
                                cursor:
                                  visibleDeleted.currentPage ===
                                  visibleDeleted.totalPages
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {totalCollections === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        backgroundColor: "#f0fdf4",
                        border: "2px solid #10b981",
                        borderRadius: "8px",
                        color: "#065f46",
                      }}
                    >
                      ✅ No schema differences found. Schemas are in sync!
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Progress Indicator */}
        {(schemaMigrationStep !== "idle" ||
          loading.schema_snapshot ||
          loading.schema_diff ||
          loading.schema_apply) && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "#fbbf24",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#92400e",
            }}
          >
            <strong>Status:</strong>{" "}
            {loading.schema_snapshot
              ? "📸 Getting schema snapshot from source..."
              : loading.schema_diff
              ? "🔍 Comparing schemas..."
              : loading.schema_apply
              ? "⚡ Applying changes to target..."
              : schemaMigrationStep === "snapshot"
              ? "📸 Retrieved schema snapshot from source"
              : schemaMigrationStep === "diff"
              ? "🔍 Ready to compare schemas"
              : schemaMigrationStep === "apply"
              ? "⚡ Ready to apply changes to target"
              : schemaMigrationStep === "complete"
              ? "✅ Schema migration completed successfully!"
              : ""}
          </div>
        )}

        {/* Migrated Collections List */}
        {schemaMigratedCollections.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              backgroundColor: "#d1fae5",
              border: "2px solid #10b981",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  color: "#065f46",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                }}
              >
                ✅ Successfully Migrated Collections (
                {schemaMigratedCollections.length})
              </h4>
              <button
                onClick={() => setSchemaMigratedCollections([])}
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.75rem",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
                title="Clear list"
              >
                🗑️ Clear
              </button>
            </div>
            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {schemaMigratedCollections.map((collection, index) => (
                <div
                  key={`${collection}-${index}`}
                  style={{
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "white",
                    border: "1px solid #10b981",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    color: "#065f46",
                    fontFamily: "monospace",
                    wordBreak: "break-word",
                  }}
                >
                  {collection}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Migration Options */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          border: "1px solid #0ea5e9",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ margin: 0 }}>🚀 Advanced Migration</h3>
          <button
            onClick={() => setShowDocumentation(true)}
            style={{
              backgroundColor: "transparent",
              color: "#6366f1",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              fontWeight: "500",
              border: "1px solid #6366f1",
              borderRadius: "4px",
              cursor: "pointer",
              textDecoration: "none",
            }}
            title="View API documentation and examples"
          >
            📚 Documentation
          </button>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowFlowsManager(true)}
            style={{
              flex: 1,
              backgroundColor: "#8b5cf6",
              color: "white",
              padding: "0.75rem 1.5rem",
              border: "none",
              borderRadius: "6px",
              cursor: loading.refresh_collections
                ? "pointer"
                : Object.values(loading).some(Boolean)
                ? "not-allowed"
                : "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: loading.refresh_collections
                ? 1
                : Object.values(loading).some(Boolean) ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            disabled={
              loading.refresh_collections 
              ? false
              : Object.values(loading).some(Boolean)
            }
          >
            🔄 Flows & Operations
          </button>

          <button
            onClick={() => setShowAccessControlManager(true)}
            style={{
              flex: 1,
              backgroundColor: "#f59e0b",
              color: "white",
              padding: "0.75rem 1.5rem",
              border: "none",
              borderRadius: "6px",
              cursor: loading.refresh_collections
                ? "pointer"
                : Object.values(loading).some(Boolean)
                ? "not-allowed"
                : "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: loading.refresh_collections
                ? 1
                : Object.values(loading).some(Boolean) ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            disabled={
              loading.refresh_collections 
              ? false
              : Object.values(loading).some(Boolean)
            }
          >
            🔐 Roles, Policies & Permissions
          </button>

          <button
            onClick={() => setShowFilesManager(true)}
            style={{
              flex: 1,
              backgroundColor: "#0891b2",
              color: "white",
              padding: "0.75rem 1.5rem",
              border: "none",
              borderRadius: "6px",
              cursor: loading.refresh_collections
                ? "pointer"
                : Object.values(loading).some(Boolean)
                ? "not-allowed"
                : "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: loading.refresh_collections
                ? 1
                : Object.values(loading).some(Boolean) ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            disabled={
              loading.refresh_collections 
              ? false
              : Object.values(loading).some(Boolean)
            }
          >
            📁 Files & Folders
          </button>
        </div>
      </div>

      {/* Data Import Config */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            marginBottom: showImportOptions ? "1rem" : "0",
          }}
          onClick={() => setShowImportOptions(!showImportOptions)}
        >
          <h3 style={{ margin: 0 }}>⚙️ Data Import Config</h3>
          <span style={{ fontSize: "1.25rem", userSelect: "none" }}>
            {showImportOptions ? "▼" : "▶"}
          </span>
        </div>

        {showImportOptions && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {/* Exclude Relational Fields Option */}
            <div
              style={{
                padding: "1rem",
                backgroundColor: excludeRelationalFields
                  ? "#dbeafe"
                  : "#f3f4f6",
                borderRadius: "6px",
                border: `2px solid ${
                  excludeRelationalFields ? "#3b82f6" : "#e5e7eb"
                }`,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                  fontSize: "0.9375rem",
                  fontWeight: "500",
                }}
              >
                <input
                  type="checkbox"
                  checked={excludeRelationalFields}
                  onChange={(e) => setExcludeRelationalFields(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span>Exclude Relational Fields (M2O, O2M, M2M)</span>
              </label>
              <div
                style={{
                  marginTop: "0.5rem",
                  marginLeft: "2rem",
                  fontSize: "0.8125rem",
                  color: "#64748b",
                  lineHeight: "1.4",
                }}
              >
                {excludeRelationalFields ? (
                  <>
                    ✅ <strong>Enabled:</strong> Import only regular fields. Use
                    this for first migration.
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Disabled:</strong> Import all fields including
                    relations. Use after base data exists.
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Migration Warning */}
      {selectedCollections.some(
        (col) => col === "directus_files" || col === "directus_folders"
      ) ||
      collections.some(
        (c) =>
          selectedCollections.includes(c.collection) &&
          (c.meta?.note?.includes("file") ||
            JSON.stringify(c.schema).includes("directus_files"))
      ) ? (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#dbeafe",
            borderRadius: "6px",
            border: "1px solid #3b82f6",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#1e40af",
              marginBottom: "0.5rem",
            }}
          >
            📎 Files & Foreign Keys Notice:
          </div>
          <div
            style={{ fontSize: "0.8rem", color: "#1e40af", lineHeight: "1.4" }}
          >
            <strong>Important:</strong> If your collections contain file fields,
            follow this order:
            <ol style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
              <li>
                <strong>First:</strong> Migrate <code>directus_folders</code>{" "}
                (if using folder structure)
              </li>
              <li>
                <strong>Second:</strong> Use "Files Manager" tab to migrate
                files → this creates records in <code>directus_files</code>
              </li>
              <li>
                <strong>Then:</strong> Migrate your collections with file
                references
              </li>
            </ol>
            This prevents foreign key errors when migrating data with file
            references.
          </div>
        </div>
      ) : null}

      {/* Custom Collections List */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h3 style={{ margin: 0 }}>
            📦 Custom Collections (
            {
              collections.filter((c) => !c.collection.startsWith("directus_"))
                .length
            }
            )
          </h3>
        </div>


      {/* Main Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleImportSelectedCollections}
          disabled={
            selectedCollections.length === 0 ||
            loading.batch_import ||
            Object.values(loading).some(Boolean)
          }
          style={{
            backgroundColor:
              selectedCollections.length === 0 ? "#9ca3af" : "#10b981",
            color: "white",
            padding: "0.75rem 1.5rem",
            fontWeight: "600",
            borderRadius: "6px",
            border: "none",
            cursor:
              selectedCollections.length === 0 ? "not-allowed" : "pointer",
            minWidth: "200px",
            opacity: selectedCollections.length === 0 ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {loading.batch_import ? (
            <>⏳ Importing...</>
          ) : (
            <>🚀 Import Selected ({selectedCollections.length})</>
          )}
        </button>

        <div style={{ display: "flex", gap: "1rem" }}>
          {Object.keys(importResults).length > 0 && (
            <button
              onClick={() => setShowImportResults(true)}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "0.75rem 1.5rem",
                fontWeight: "500",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                minWidth: "140px",
              }}
            >
              📊 View Results
            </button>
          )}

          {dataErrorLogs.length > 0 && (
            <button
              onClick={()=>{
                setErrorLogCategory("data");
                setShowErrorLogs(true);
              }}
              style={{
                backgroundColor: "#f59e0b",
                color: "#78350f",
                padding: "0.75rem 1.5rem",
                fontWeight: "500",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                minWidth: "140px"
              }}
            >
              Data Errors ({dataErrorLogs.length})
            </button>
          )}

          <button
            onClick={async () => {
              setLoading("refresh_collections", true);
              try {
                //await loadTargetCollections();
                await Promise.all([
                  loadTargetCollections(),
                  onRefreshCollections()
                ])
                onStatusUpdate({
                  type: "info",
                  message: "Collections refreshed successfully",
                });
              } catch (error: any) {
                onStatusUpdate({
                  type: "error",
                  message: `Failed to refresh: ${error.message}`,
                });
              } finally {
                setLoading("refresh_collections", false);
              }
            }}
            style={{
              backgroundColor: "#6b7280",
              color: "white",
              padding: "0.75rem 1.5rem",
              fontWeight: "500",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              minWidth: "140px",
            }}
            disabled={Object.values(loading).some(Boolean)}
          >
            {loading.refresh_collections ? "Loading..." : "Refresh Load Collections"}
          </button>
        </div>
      </div>

        {/* Overall Migration Progress */}
        {(() => {
          const totalCurrent = Object.values(importProgress).reduce(
            (sum, p) => sum + p.current,
            0
          );
          const totalItems = Object.values(importProgress).reduce(
            (sum, p) => sum + p.total,
            0
          );
          const activeCollections = Object.keys(importProgress).length;

          if (activeCollections === 0) return null;

          return (
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#f0f9ff",
                borderRadius: "8px",
                border: "2px solid #3b82f6",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: "600",
                    color: "#1e40af",
                  }}
                >
                  🚀 Overall Migration Progress
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "#1e40af",
                    fontWeight: "500",
                  }}
                >
                  {activeCollections} collection
                  {activeCollections > 1 ? "s" : ""} migrating
                </div>
              </div>

              <div style={{ marginBottom: "0.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "#1e40af",
                      fontWeight: "500",
                    }}
                  >
                    Total Items: {totalCurrent} / {totalItems}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "#1e40af",
                      fontWeight: "600",
                    }}
                  >
                    {totalItems > 0
                      ? Math.round((totalCurrent / totalItems) * 100)
                      : 0}
                    %
                  </span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "12px",
                    backgroundColor: "#dbeafe",
                    borderRadius: "6px",
                    overflow: "hidden",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    style={{
                      width: `${
                        totalItems > 0 ? (totalCurrent / totalItems) * 100 : 0
                      }%`,
                      height: "100%",
                      backgroundColor: "#3b82f6",
                      transition: "width 0.3s ease",
                      boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
                    }}
                  ></div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#60a5fa",
                  marginTop: "0.5rem",
                }}
              >
                {Object.entries(importProgress).map(
                  ([collection, progress]) => (
                    <div key={collection} style={{ marginBottom: "0.25rem" }}>
                      • {collection}: {progress.current}/{progress.total}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {/* Best Practice Guide for Relational Fields */}
        {showBestPracticeGuide && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "1.5rem",
              backgroundColor: "#fef3c7",
              borderRadius: "8px",
              border: "2px solid #f59e0b",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowBestPracticeGuide(false)}
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#92400e",
              }}
            >
              ×
            </button>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "600",
                color: "#92400e",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              💡 Best Practice for Relational Fields:
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                color: "#78350f",
                lineHeight: "1.6",
              }}
            >
              <p style={{ marginBottom: "0.75rem" }}>
                When migrating data with relational fields (M2O, O2M, M2M, M2A):
              </p>
              <ol style={{ marginLeft: "1.5rem", marginBottom: "0.75rem" }}>
                <li>
                  <strong>
                    First migration: Exclude relational fields to migrate base
                    data
                  </strong>
                  <ul style={{ marginLeft: "1rem", marginTop: "0.25rem" }}>
                    <li>✅ Enable "Exclude Relational Fields" option below</li>
                    <li>
                      ✅ Import all collections (this creates records with their
                      IDs)
                    </li>
                  </ul>
                </li>
                <li style={{ marginTop: "0.5rem" }}>
                  <strong>
                    After all related data is migrated: Run second migration
                    (update mode) to populate relational fields
                  </strong>
                  <ul style={{ marginLeft: "1rem", marginTop: "0.25rem" }}>
                    <li>✅ Disable "Exclude Relational Fields" option</li>
                    <li>
                      ✅ Re-import collections (will UPDATE existing records
                      with relations)
                    </li>
                  </ul>
                </li>
              </ol>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#fef9e7",
                  borderRadius: "4px",
                  marginTop: "0.75rem",
                  border: "1px solid #f59e0b",
                }}
              >
                <strong>⚠️ Special case - Junction Tables (M2M):</strong>
                <ol
                  style={{
                    marginLeft: "1rem",
                    marginTop: "0.5rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  <li>
                    Import both related collections with "Exclude Relational
                    Fields" enabled
                  </li>
                  <li>
                    Import the junction table (e.g., `posts_tags`) with regular
                    fields only
                  </li>
                  <li>
                    Finally, re-import all collections with "Exclude Relational
                    Fields" disabled
                  </li>
                </ol>
              </div>
              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.8125rem",
                  fontStyle: "italic",
                }}
              >
                <strong>Why?</strong> This prevents foreign key constraint
                errors and ensures data integrity.
              </p>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div></div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Search Collection */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="🔍 Search collections..."
                value={collectionSearchTerm}
                onChange={(e) => {
                  setCollectionSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  paddingRight: collectionSearchTerm ? "2rem" : "0.75rem",
                  fontSize: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  minWidth: "200px",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
              />
              {collectionSearchTerm && (
                <button
                  onClick={() => {
                    setCollectionSearchTerm("");
                    setCurrentPage(1);
                  }}
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                    color: "#6b7280",
                    fontSize: "0.875rem",
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Pagination Controls */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                Show:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                per page
              </span>
            </div>

            <div
              style={{
                width: "1px",
                height: "20px",
                backgroundColor: "#d1d5db",
              }}
            ></div>

            <button
              onClick={() => {
                setStatusFilter("existing");
                setCurrentPage(1);
                const customCollections = collections.filter(
                  (c) =>
                    showSystemCollections ||
                    !c.collection.startsWith("directus_")
                );
                const existingCollections = customCollections.filter(
                  (c) => getCollectionStatus(c) === "existing"
                );
                setSelectedCollections((prev) => [
                  ...prev.filter(
                    (id) => !showSystemCollections && id.startsWith("directus_")
                  ),
                  ...existingCollections.map((c) => c.collection),
                ]);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor:
                  statusFilter === "existing" ? "#f97316" : "#e5e7eb",
                color: statusFilter === "existing" ? "white" : "#374151",
              }}
            >
              Existing (
              {
                collections.filter(
                  (c) =>
                    !c.collection.startsWith("directus_") &&
                    getCollectionStatus(c) === "existing"
                ).length
              }
              )
            </button>
            <button
              onClick={() => {
                setStatusFilter("new");
                setCurrentPage(1);
                setShowNewCollectionWarning(true);
                const customCollections = collections.filter(
                  (c) =>
                    showSystemCollections ||
                    !c.collection.startsWith("directus_")
                );
                const newCollections = customCollections.filter(
                  (c) => getCollectionStatus(c) === "new"
                );
                setSelectedCollections((prev) => [
                  ...prev.filter(
                    (id) => !showSystemCollections && id.startsWith("directus_")
                  ),
                  ...newCollections.map((c) => c.collection),
                ]);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: statusFilter === "new" ? "#3B82F6" : "#e5e7eb",
                color: statusFilter === "new" ? "white" : "#374151",
              }}
            >
              New (
              {
                collections.filter(
                  (c) =>
                    !c.collection.startsWith("directus_") &&
                    getCollectionStatus(c) === "new"
                ).length
              }
              )
            </button>
            <button
              onClick={() =>
                setSelectedCollections((prev) =>
                  prev.filter((id) => id.startsWith("directus_"))
                )
              }
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: "#6b7280",
                color: "white",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {(() => {
            const filteredCollections = collections.filter((c) => {
              if (
                !showSystemCollections &&
                c.collection.startsWith("directus_")
              )
                return false;

              if (
                statusFilter === "existing" &&
                getCollectionStatus(c) !== "existing"
              )
                return false;
              if (statusFilter === "new" && getCollectionStatus(c) !== "new")
                return false;

              if (collectionSearchTerm.trim()) {
                const searchLower = collectionSearchTerm.toLowerCase().trim();
                const collectionName = c.collection?.toLowerCase() || "";
                const metaNote = c.meta?.note?.toLowerCase() || "";

                const matchesSearch =
                  collectionName.includes(searchLower) ||
                  metaNote.includes(searchLower);

                if (!matchesSearch) return false;
              }

              return true;
            });

            const totalItems = filteredCollections.length;
            const startIndex =
              itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
            const endIndex =
              itemsPerPage === -1 ? totalItems : startIndex + itemsPerPage;
            const paginatedCollections = filteredCollections.slice(
              startIndex,
              endIndex
            );

            return paginatedCollections.map((collection) => {
              const isSelected = selectedCollections.includes(
                collection.collection
              );
              const collectionStatus = getCollectionStatus(collection);

              return (
                <div
                  key={collection.collection}
                  className="collection-item"
                  style={{
                    padding: "1rem",
                    border: `1px solid ${isSelected ? "#93c5fd" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    backgroundColor: isSelected ? "#f0f9ff" : "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollections((prev) => [
                            ...prev,
                            collection.collection,
                          ]);
                        } else {
                          setSelectedCollections((prev) =>
                            prev.filter((c) => c !== collection.collection)
                          );
                        }
                      }}
                      style={{ transform: "scale(1.2)" }}
                    />

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "1rem",
                              fontWeight: "600",
                              color: "#1f2937",
                            }}
                          >
                            {collection.collection}
                          </h4>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          {/* Target Status Badge */}
                          <span
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "500",
                              backgroundColor:
                                collectionStatus === "existing"
                                  ? "#fef3c7"
                                  : collectionStatus === "new"
                                  ? "#dbeafe"
                                  : "#f3f4f6",
                              color:
                                collectionStatus === "existing"
                                  ? "#92400e"
                                  : collectionStatus === "new"
                                  ? "#1e40af"
                                  : "#6b7280",
                              lineHeight: "1",
                            }}
                          >
                            {collectionStatus === "existing"
                              ? "Existing"
                              : collectionStatus === "new"
                              ? "New"
                              : "Unknown"}
                          </span>

                          {collection.meta?.singleton && (
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: "9999px",
                                fontSize: "0.75rem",
                                fontWeight: "500",
                                backgroundColor: "#dc2626",
                                color: "white",
                              }}
                            >
                              Singleton
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Collection Meta Info */}
                      {collection.meta && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7280",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {collection.meta.note && (
                            <div>📝 {collection.meta.note}</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="button-group">
                      {loading[`import_${collection.collection}`] &&
                      importProgress[collection.collection] ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.5rem 1rem",
                            backgroundColor: "#fef3c7",
                            borderRadius: "6px",
                            border: "2px solid #f59e0b",
                            minWidth: "200px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#92400e",
                                marginBottom: "0.25rem",
                                fontWeight: "500",
                              }}
                            >
                              Importing...{" "}
                              {importProgress[collection.collection].current}/
                              {importProgress[collection.collection].total}
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: "6px",
                                backgroundColor: "#fde68a",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${
                                    (importProgress[collection.collection]
                                      .current /
                                      importProgress[collection.collection]
                                        .total) *
                                    100
                                  }%`,
                                  height: "100%",
                                  backgroundColor: "#f59e0b",
                                  transition: "width 0.3s ease",
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {collection.meta?.singleton ? (
                            <button
                              onClick={() =>
                                handleImportSingleton(collection.collection)
                              }
                              disabled={
                                loading[`import_${collection.collection}`] ||
                                collectionStatus === "new"
                              }
                              style={{
                                backgroundColor:
                                  collectionStatus === "new"
                                    ? "#9ca3af"
                                    : "#10b981",
                                color: "white",
                                padding: "0.5rem 1rem",
                                borderRadius: "6px",
                                border: "none",
                                cursor:
                                  collectionStatus === "new"
                                    ? "not-allowed"
                                    : "pointer",
                                fontWeight: "500",
                                fontSize: "0.875rem",
                              }}
                              title="Import singleton collection (only 1 record)"
                            >
                              🔄 Import Singleton
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handlePreviewItems(collection.collection)
                              }
                              disabled={
                                loading[`import_${collection.collection}`] ||
                                collectionStatus === "new"
                              }
                              style={{
                                backgroundColor:
                                  collectionStatus === "new"
                                    ? "#9ca3af"
                                    : "#3b82f6",
                                color: "white",
                                padding: "0.5rem 1rem",
                                borderRadius: "6px",
                                border: "none",
                                cursor:
                                  collectionStatus === "new"
                                    ? "not-allowed"
                                    : "pointer",
                                fontWeight: "500",
                                fontSize: "0.875rem",
                              }}
                              title="Preview and select specific items to import"
                            >
                              📋 Select Items
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Pagination Navigation */}
        {(() => {
          const filteredCollections = collections.filter((c) => {
            if (!showSystemCollections && c.collection.startsWith("directus_"))
              return false;

            if (
              statusFilter === "existing" &&
              getCollectionStatus(c) !== "existing"
            )
              return false;
            if (statusFilter === "new" && getCollectionStatus(c) !== "new")
              return false;

            if (collectionSearchTerm.trim()) {
              const searchLower = collectionSearchTerm.toLowerCase().trim();
              const collectionName = c.collection?.toLowerCase() || "";
              const metaNote = c.meta?.note?.toLowerCase() || "";

              const matchesSearch =
                collectionName.includes(searchLower) ||
                metaNote.includes(searchLower);

              if (!matchesSearch) return false;
            }

            return true;
          });

          const totalItems = filteredCollections.length;
          const totalPages =
            itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);

          if (itemsPerPage === -1 || totalPages <= 1) return null;

          return (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "1rem",
                padding: "1rem",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: currentPage === 1 ? "#f3f4f6" : "white",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  color: currentPage === 1 ? "#9ca3af" : "#374151",
                }}
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: currentPage === 1 ? "#f3f4f6" : "white",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  color: currentPage === 1 ? "#9ca3af" : "#374151",
                }}
              >
                «
              </button>

              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  padding: "0 0.5rem",
                }}
              >
                Page {currentPage} of {totalPages} ({totalItems} items)
              </span>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor:
                    currentPage === totalPages ? "#f3f4f6" : "white",
                  cursor:
                    currentPage === totalPages ? "not-allowed" : "pointer",
                  color: currentPage === totalPages ? "#9ca3af" : "#374151",
                }}
              >
                »
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor:
                    currentPage === totalPages ? "#f3f4f6" : "white",
                  cursor:
                    currentPage === totalPages ? "not-allowed" : "pointer",
                  color: currentPage === totalPages ? "#9ca3af" : "#374151",
                }}
              >
                »»
              </button>
            </div>
          );
        })()}
      </div>

      {/* System Collections Section - Dangerous */}
      <div
        style={{
          border: "2px solid #dc2626",
          borderRadius: "8px",
          backgroundColor: "#fef2f2",
          padding: "1rem",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <h3 style={{ margin: 0, color: "#dc2626" }}>
              ⚠️ System Collections (
              {
                collections.filter((c) => c.collection.startsWith("directus_"))
                  .length
              }
              )
            </h3>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.7rem",
                fontWeight: "600",
                backgroundColor: "#dc2626",
                color: "white",
              }}
            >
              DANGEROUS
            </span>
          </div>

          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#fee2e2",
              borderRadius: "6px",
              border: "1px solid #fecaca",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#dc2626",
                marginBottom: "0.5rem",
              }}
            >
              🚨 Critical Warning:
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#dc2626",
                lineHeight: "1.4",
              }}
            >
              System collections contain core Directus functionality. Migrating
              these can break your target instance. Only proceed if you
              understand the risks and have a full backup.
            </div>
          </div>

          {!showSystemCollections ? (
            <button
              onClick={() => setShowSystemCollections(true)}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "none",
                fontWeight: "500",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              🔓 Show System Collections
            </button>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={systemCollectionsAcknowledged}
                    onChange={(e) =>
                      setSystemCollectionsAcknowledged(e.target.checked)
                    }
                    style={{ transform: "scale(1.2)" }}
                  />
                  <span style={{ color: "#dc2626", fontWeight: "500" }}>
                    I understand the risks and have backed up my target instance
                  </span>
                </label>
              </div>

              <div
                style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
              >
                <button
                  onClick={() => {
                    const systemCollections = collections.filter((c) =>
                      c.collection.startsWith("directus_")
                    );
                    const systemSelected = selectedCollections.filter((id) =>
                      id.startsWith("directus_")
                    );
                    if (systemSelected.length === systemCollections.length) {
                      setSelectedCollections((prev) =>
                        prev.filter((id) => !id.startsWith("directus_"))
                      );
                    } else {
                      setSelectedCollections((prev) => [
                        ...prev.filter((id) => !id.startsWith("directus_")),
                        ...systemCollections.map((c) => c.collection),
                      ]);
                    }
                  }}
                  disabled={!systemCollectionsAcknowledged}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid #bfdbfe",
                    borderRadius: "4px",
                    cursor: systemCollectionsAcknowledged
                      ? "pointer"
                      : "not-allowed",
                    fontWeight: "500",
                    backgroundColor: systemCollectionsAcknowledged
                      ? "#dbeafe"
                      : "#f3f4f6",
                    color: systemCollectionsAcknowledged
                      ? "#1d4ed8"
                      : "#9ca3af",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const systemCollections = collections.filter((c) =>
                      c.collection.startsWith("directus_")
                    );
                    const existingCollections = systemCollections.filter(
                      (c) => getCollectionStatus(c) === "existing"
                    );
                    setSelectedCollections((prev) => [
                      ...prev.filter((id) => !id.startsWith("directus_")),
                      ...existingCollections.map((c) => c.collection),
                    ]);
                  }}
                  disabled={!systemCollectionsAcknowledged}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid #fecaca",
                    borderRadius: "4px",
                    cursor: systemCollectionsAcknowledged
                      ? "pointer"
                      : "not-allowed",
                    fontWeight: "500",
                    backgroundColor: systemCollectionsAcknowledged
                      ? "#fee2e2"
                      : "#f3f4f6",
                    color: systemCollectionsAcknowledged
                      ? "#dc2626"
                      : "#9ca3af",
                  }}
                >
                  Existing (
                  {
                    collections.filter(
                      (c) =>
                        c.collection.startsWith("directus_") &&
                        getCollectionStatus(c) === "existing"
                    ).length
                  }
                  )
                </button>
                <button
                  onClick={() => {
                    const systemCollections = collections.filter((c) =>
                      c.collection.startsWith("directus_")
                    );
                    const newCollections = systemCollections.filter(
                      (c) => getCollectionStatus(c) === "new"
                    );
                    setSelectedCollections((prev) => [
                      ...prev.filter((id) => !id.startsWith("directus_")),
                      ...newCollections.map((c) => c.collection),
                    ]);
                  }}
                  disabled={!systemCollectionsAcknowledged}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid #bbf7d0",
                    borderRadius: "4px",
                    cursor: systemCollectionsAcknowledged
                      ? "pointer"
                      : "not-allowed",
                    fontWeight: "500",
                    backgroundColor: systemCollectionsAcknowledged
                      ? "#dcfce7"
                      : "#f3f4f6",
                    color: systemCollectionsAcknowledged
                      ? "#16a34a"
                      : "#9ca3af",
                  }}
                >
                  New (
                  {
                    collections.filter(
                      (c) =>
                        c.collection.startsWith("directus_") &&
                        getCollectionStatus(c) === "new"
                    ).length
                  }
                  )
                </button>
                <button
                  onClick={() =>
                    setSelectedCollections((prev) =>
                      prev.filter((id) => !id.startsWith("directus_"))
                    )
                  }
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    backgroundColor: "#f3f4f6",
                    color: "#6b7280",
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setShowSystemCollections(false);
                    setSystemCollectionsAcknowledged(false);
                    setSelectedCollections((prev) =>
                      prev.filter((id) => !id.startsWith("directus_"))
                    );
                  }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid #6b7280",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    backgroundColor: "#6b7280",
                    color: "white",
                  }}
                >
                  🔒 Hide System Collections
                </button>
              </div>

              <div style={{ display: "grid", gap: "1rem" }}>
                {collections
                  .filter((c) => c.collection.startsWith("directus_"))
                  .map((collection) => {
                    const isSelected = selectedCollections.includes(
                      collection.collection
                    );
                    const collectionStatus = getCollectionStatus(collection);

                    return (
                      <div
                        key={collection.collection}
                        style={{
                          padding: "1rem",
                          border: `2px solid ${
                            isSelected ? "#dc2626" : "#fecaca"
                          }`,
                          borderRadius: "8px",
                          backgroundColor: isSelected ? "#fee2e2" : "#fefefe",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!systemCollectionsAcknowledged}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCollections((prev) => [
                                  ...prev,
                                  collection.collection,
                                ]);
                              } else {
                                setSelectedCollections((prev) =>
                                  prev.filter(
                                    (c) => c !== collection.collection
                                  )
                                );
                              }
                            }}
                            style={{
                              transform: "scale(1.2)",
                              opacity: systemCollectionsAcknowledged ? 1 : 0.5,
                            }}
                          />

                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: "1rem",
                                  fontWeight: "600",
                                  color: "#dc2626",
                                }}
                              >
                                {collection.collection}
                              </h4>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                {/* Target Status Badge */}
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: "9999px",
                                    fontSize: "0.7rem",
                                    fontWeight: "500",
                                    backgroundColor:
                                      collectionStatus === "existing"
                                        ? "#fef3c7"
                                        : collectionStatus === "new"
                                        ? "#dbeafe"
                                        : "#f3f4f6",
                                    color:
                                      collectionStatus === "existing"
                                        ? "#92400e"
                                        : collectionStatus === "new"
                                        ? "#1e40af"
                                        : "#6b7280",
                                  }}
                                >
                                  {collectionStatus === "existing"
                                    ? "Existing"
                                    : collectionStatus === "new"
                                    ? "New"
                                    : "Unknown"}
                                </span>
                              </div>
                            </div>

                            {collection.meta && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                {collection.meta.note && (
                                  <div>📝 {collection.meta.note}</div>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            {loading[`import_${collection.collection}`] &&
                            importProgress[collection.collection] ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.75rem",
                                  padding: "0.5rem 1rem",
                                  backgroundColor: "#fef2f2",
                                  borderRadius: "6px",
                                  border: "2px solid #dc2626",
                                  minWidth: "200px",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#991b1b",
                                      marginBottom: "0.25rem",
                                      fontWeight: "500",
                                    }}
                                  >
                                    Importing...{" "}
                                    {
                                      importProgress[collection.collection]
                                        .current
                                    }
                                    /
                                    {
                                      importProgress[collection.collection]
                                        .total
                                    }
                                  </div>
                                  <div
                                    style={{
                                      width: "100%",
                                      height: "6px",
                                      backgroundColor: "#fecaca",
                                      borderRadius: "3px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${
                                          (importProgress[collection.collection]
                                            .current /
                                            importProgress[
                                              collection.collection
                                            ].total) *
                                          100
                                        }%`,
                                        height: "100%",
                                        backgroundColor: "#dc2626",
                                        transition: "width 0.3s ease",
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleImport(collection.collection)
                                }
                                disabled={
                                  loading[`import_${collection.collection}`] ||
                                  !systemCollectionsAcknowledged
                                }
                                style={{
                                  backgroundColor:
                                    !systemCollectionsAcknowledged
                                      ? "#9ca3af"
                                      : "#dc2626",
                                  color: "white",
                                  padding: "0.5rem 1rem",
                                  borderRadius: "6px",
                                  border: "none",
                                  fontWeight: "500",
                                  cursor:
                                    loading[
                                      `import_${collection.collection}`
                                    ] || !systemCollectionsAcknowledged
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity:
                                    loading[
                                      `import_${collection.collection}`
                                    ] || !systemCollectionsAcknowledged
                                      ? 0.7
                                      : 1,
                                }}
                              >
                                {!systemCollectionsAcknowledged
                                  ? "Acknowledge First"
                                  : "Import System"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Collection Warning Modal */}
      {showNewCollectionWarning && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "12px",
              maxWidth: "500px",
              margin: "1rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "2rem", marginRight: "0.5rem" }}>
                ⚠️
              </span>
              <h3 style={{ margin: 0, color: "#dc2626" }}>
                Schema Sync Required
              </h3>
            </div>

            <div style={{ marginBottom: "1.5rem", lineHeight: "1.6" }}>
              <p style={{ margin: "0 0 1rem 0" }}>
                You've selected <strong>"New"</strong> collections that don't
                exist in the target environment.
              </p>
              <p style={{ margin: "0 0 1rem 0" }}>
                <strong>Before importing data</strong>, you must sync the
                collection schemas first:
              </p>
              <ol style={{ margin: "0 0 1rem 1.5rem", paddingLeft: 0 }}>
                <li>
                  Export schema from source:{" "}
                  <code>directus schema snapshot</code>
                </li>
                <li>
                  Import schema to target: <code>directus schema apply</code>
                </li>
                <li>Or manually create collections in target Directus</li>
              </ol>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
                Import buttons are disabled for "New" collections to prevent
                errors.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowNewCollectionWarning(false)}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#6b7280",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flows Manager Modal */}
      <FlowsManager
        sourceUrl={sourceUrl}
        sourceToken={sourceToken}
        targetUrl={targetUrl}
        targetToken={targetToken}
        isVisible={showFlowsManager}
        onClose={() => setShowFlowsManager(false)}
        onStatusUpdate={(status) =>
          onStatusUpdate({
            type: status.type,
            message: status.message,
          })
        }
      />

      {/* Access Control Manager Modal */}
      <AccessControlManager
        sourceUrl={sourceUrl}
        sourceToken={sourceToken}
        targetUrl={targetUrl}
        targetToken={targetToken}
        isVisible={showAccessControlManager}
        onClose={() => setShowAccessControlManager(false)}
        onStatusUpdate={(status) =>
          onStatusUpdate({
            type: status.type,
            message: status.message,
          })
        }
      />

      {/* Files Manager Modal */}
      {showFilesManager && (
        <FilesManager
          sourceUrl={sourceUrl}
          sourceToken={sourceToken}
          targetUrl={targetUrl}
          targetToken={targetToken}
          onClose={() => setShowFilesManager(false)}
          onStatusUpdate={onStatusUpdate}
        />
      )}

      {/* Item Selector Modal */}
      {showItemSelector && (
        <ItemSelectorModal
          collectionName={currentPreviewCollection}
          items={previewItems}
          total={previewTotal}
          selectedIds={selectedItemIds}
          onSelectionChange={setSelectedItemIds}
          onClose={() => setShowItemSelector(false)}
          onImport={handleImportSelected}
          onLoadMore={() => {}}
          hasMore={false}
          loading={loadingPreview}
          relations={sourceRelations}
          importing={loading[`import_selected_${currentPreviewCollection}`]}
          importProgress={importProgress[currentPreviewCollection]}
        />
      )}

      {/* Error Logs Modal */}
      {showErrorLogs &&
        (() => {
          const logsToDisplay = errorLogs.filter(
            (log) => log.category === errorLogCategory
          );
          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "2rem",
                  borderRadius: "12px",
                  maxWidth: "800px",
                  maxHeight: "80vh",
                  margin: "1rem",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h3 style={{ margin: 0, color: "#dc2626" }}>
                    🚨 {errorLogCategory === "schema" ? "Schema" : "Data"} Error
                    Logs ({logsToDisplay.length})
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => setErrorLogs([])}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        color: "#6b7280",
                        cursor: "pointer",
                      }}
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowErrorLogs(false)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        color: "#6b7280",
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
 
                <div
                  style={{
                    flex: 1,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  {logsToDisplay.length === 0 ? (
                    <div
                      style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No error logs yet
                    </div>
                  ) : (
                    logsToDisplay.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: "1rem",
                          borderBottom: "1px solid #e5e7eb",
                          fontFamily: "monospace",
                          fontSize: "0.875rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <strong style={{ color: "#dc2626" }}>
                            {log.operation}
                          </strong>
                          <span
                            style={{ color: "#6b7280", fontSize: "0.75rem" }}
                          >
                            {log.timestamp}
                          </span>
                        </div>
 
                        <div style={{ marginBottom: "0.5rem" }}>
                          <strong>Message:</strong> {log.error.message}
                        </div>
 
                        <div style={{ marginBottom: "0.5rem" }}>
                          <strong>Status:</strong> {log.error.status}{" "}
                          {log.error.statusText}
                        </div>
 
                        {log.error.data && (
                          <details style={{ marginTop: "0.5rem" }}>
                            <summary
                              style={{ cursor: "pointer", color: "#3b82f6" }}
                            >
                              View Error Details
                            </summary>
                            <pre
                              style={{
                                marginTop: "0.5rem",
                                padding: "0.5rem",
                                backgroundColor: "#fee2e2",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                overflow: "auto",
                                maxHeight: "200px",
                                border: "1px solid #fecaca",
                              }}
                            >
                              {JSON.stringify(log.error.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Import Results Modal */}
      {showImportResults && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "2rem",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              position: "relative",
              width: "900px",
            }}
          >
            <button
              onClick={() => setShowImportResults(false)}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
            >
              ×
            </button>

            <h2 style={{ marginBottom: "1.5rem" }}>📊 Import Results</h2>

            {Object.entries(importResults).map(([collectionName, result]) => {
              const totalSuccess = result.success.length;
              const totalFailed = result.failed.length;
              const total = totalSuccess + totalFailed;

              return (
                <div
                  key={collectionName}
                  style={{
                    marginBottom: "2rem",
                    padding: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{
                      marginBottom: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{collectionName}</span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "4px",
                        backgroundColor:
                          totalFailed > 0 ? "#fef3c7" : "#d1fae5",
                        color: totalFailed > 0 ? "#92400e" : "#065f46",
                        fontWeight: "500",
                      }}
                    >
                      {totalSuccess}/{total} succeeded
                    </span>
                  </h3>

                  {/* Success Items */}
                  {totalSuccess > 0 && (
                    <details style={{ marginBottom: "1rem" }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          padding: "0.5rem",
                          backgroundColor: "#d1fae5",
                          borderRadius: "4px",
                          fontWeight: "500",
                          color: "#065f46",
                        }}
                      >
                        ✅ {totalSuccess} Successful Records
                      </summary>
                      <div
                        style={{
                          marginTop: "0.5rem",
                          maxHeight: "200px",
                          overflowY: "auto",
                          padding: "0.5rem",
                          backgroundColor: "white",
                          borderRadius: "4px",
                        }}
                      >
                        {result.success.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "0.25rem 0",
                              fontSize: "0.875rem",
                              borderBottom:
                                idx < result.success.length - 1
                                  ? "1px solid #f3f4f6"
                                  : "none",
                            }}
                          >
                            <code>ID: {item.id}</code> -{" "}
                            <span
                              style={{ color: "#065f46", fontWeight: "500" }}
                            >
                              {item.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Failed Items */}
                  {totalFailed > 0 && (
                    <details open style={{ marginBottom: "0.5rem" }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          padding: "0.5rem",
                          backgroundColor: "#fecaca",
                          borderRadius: "4px",
                          fontWeight: "500",
                          color: "#991b1b",
                        }}
                      >
                        ❌ {totalFailed} Failed Records
                      </summary>
                      <div
                        style={{
                          marginTop: "0.5rem",
                          maxHeight: "300px",
                          overflowY: "auto",
                          padding: "0.5rem",
                          backgroundColor: "white",
                          borderRadius: "4px",
                        }}
                      >
                        {result.failed.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "0.5rem",
                              fontSize: "0.8125rem",
                              borderBottom:
                                idx < result.failed.length - 1
                                  ? "1px solid #f3f4f6"
                                  : "none",
                              backgroundColor: "#fef2f2",
                              borderRadius: "4px",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "600",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <code>ID: {item.id}</code>
                            </div>
                            <div
                              style={{ color: "#dc2626", fontSize: "0.75rem" }}
                            >
                              {item.error}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}

            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1rem",
                borderTop: "2px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => {
                  setImportResults({});
                  setShowImportResults(false);
                }}
                style={{
                  backgroundColor: "#6b7280",
                  color: "white",
                  padding: "0.5rem 1.5rem",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Clear Results
              </button>
              <button
                onClick={() => setShowImportResults(false)}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "0.5rem 1.5rem",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentationTab
        isVisible={showDocumentation}
        onClose={() => setShowDocumentation(false)}
      />
    </div>
  );
}
