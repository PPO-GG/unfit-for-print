import { ref, reactive } from "vue";
import { useNotifications } from "~/composables/useNotifications";

export const useCardImporter = (options?: { onComplete?: () => void }) => {
  const { notify } = useNotifications();

  const uploadState = reactive({
    file: null as File | null,
    fileContent: null as string | null,
  });

  const uploading = ref(false);
  const showPreview = ref(false);
  const previewData = ref<any[]>([]);
  const previewStats = ref({
    packs: 0,
    whiteCards: 0,
    blackCards: 0,
  });
  const uploadProgress = ref(0);
  const showProgress = ref(false);

  const seedingStats = ref({
    totalCards: 0,
    totalPacks: 0,
    whiteCardCount: 0,
    blackCardCount: 0,
    insertedCards: 0,
    skippedDuplicates: 0,
    skippedSimilar: 0,
    skippedLongText: 0,
    failedCards: 0,
    currentPack: "",
    currentCardType: "",
    position: null as string | null,
    warnings: [] as string[],
    errors: [] as string[],
  });

  const resumePosition = ref<string | null>(null);
  const showResumePrompt = ref(false);

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    uploadState.file = target.files?.[0] || null;
  };

  const parseJsonFile = async () => {
    if (!uploadState.file) return;

    try {
      uploadState.fileContent = await uploadState.file.text();
      const jsonData = JSON.parse(uploadState.fileContent);

      if (!Array.isArray(jsonData)) {
        throw new Error("Invalid JSON format: Expected an array of card packs");
      }

      previewData.value = jsonData;

      let totalWhiteCards = 0;
      let totalBlackCards = 0;

      for (const pack of jsonData) {
        totalWhiteCards += pack.white?.length || 0;
        totalBlackCards += pack.black?.length || 0;
      }

      previewStats.value = {
        packs: jsonData.length,
        whiteCards: totalWhiteCards,
        blackCards: totalBlackCards,
      };

      showPreview.value = true;
    } catch (err) {
      console.error("Error parsing JSON file:", err);
      notify({
        title: "Invalid JSON",
        description:
          "The selected file contains invalid JSON or has an incorrect format.",
        color: "error",
      });

      uploadState.fileContent = null;
      showPreview.value = false;
    }
  };

  const uploadJsonFile = async (resumeFromPosition: string | null = null) => {
    if (!uploadState.file || !uploadState.fileContent) {
      notify({
        title: "Upload Error",
        description: "No file selected or file content could not be read",
        color: "error",
      });
      return;
    }

    uploading.value = true;
    showProgress.value = true;
    uploadProgress.value = 0;

    seedingStats.value = {
      totalCards: 0,
      totalPacks: 0,
      whiteCardCount: 0,
      blackCardCount: 0,
      insertedCards: 0,
      skippedDuplicates: 0,
      skippedSimilar: 0,
      skippedLongText: 0,
      failedCards: 0,
      currentPack: "",
      currentCardType: "",
      position: null,
      warnings: [],
      errors: [],
    };

    try {
      const payload: Record<string, unknown> = {
        file: uploadState.fileContent,
        sessionId: Date.now().toString(),
      };

      if (resumeFromPosition) {
        payload.resumeFrom = resumeFromPosition;
      }

      const response = await fetch("/api/dev/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit data");
      }

      const responseData = await response.json();
      const sessionId = responseData.sessionId;

      if (!sessionId) {
        throw new Error("No session ID returned from server");
      }

      // console.log(`Card seeding started with session ID: ${sessionId}`);

      const eventSource = new EventSource(
        `/api/dev/seed/progress?sessionId=${sessionId}`,
      );

      eventSource.addEventListener("start", (event) => {
        const data = JSON.parse(event.data);
        // console.log("Seeding started:", data.message);
      });

      eventSource.addEventListener("progress", (event) => {
        const data = JSON.parse(event.data);
        uploadProgress.value = data.progress;

        if (data.totalCards) seedingStats.value.totalCards = data.totalCards;
        if (data.totalPacks) seedingStats.value.totalPacks = data.totalPacks;
        if (data.whiteCardCount)
          seedingStats.value.whiteCardCount = data.whiteCardCount;
        if (data.blackCardCount)
          seedingStats.value.blackCardCount = data.blackCardCount;
        if (data.insertedCards)
          seedingStats.value.insertedCards = data.insertedCards;
        if (data.skippedDuplicates)
          seedingStats.value.skippedDuplicates = data.skippedDuplicates;
        if (data.skippedSimilar)
          seedingStats.value.skippedSimilar = data.skippedSimilar;
        if (data.skippedLongText)
          seedingStats.value.skippedLongText = data.skippedLongText;
        if (data.failedCards) seedingStats.value.failedCards = data.failedCards;
        if (data.currentPack) seedingStats.value.currentPack = data.currentPack;
        if (data.currentCardType)
          seedingStats.value.currentCardType = data.currentCardType;
        if (data.position) seedingStats.value.position = data.position;
        if (data.warnings) seedingStats.value.warnings = data.warnings;
        if (data.errors) seedingStats.value.errors = data.errors;
      });

      eventSource.addEventListener("complete", (event) => {
        const data = JSON.parse(event.data);
        uploadProgress.value = 1;
        eventSource.close();

        notify({
          title: "Upload Complete",
          description: data.message || "Seed complete.",
          color: "success",
        });

        if (data.warnings && data.warnings.length > 0) {
          // console.log(
          //   `Seeding completed with ${data.warnings.length} warnings:`,
          //   data.warnings,
          // );
        }

        showPreview.value = false;
        setTimeout(() => {
          showProgress.value = false;
        }, 1000);

        uploading.value = false;
        if (options?.onComplete) {
          options.onComplete();
        }
      });

      eventSource.addEventListener("error", (event) => {
        const msgEvent = event as MessageEvent;
        const data = msgEvent.data
          ? JSON.parse(msgEvent.data)
          : { message: "Unknown error occurred" };
        console.error("Seeding error:", data);

        eventSource.close();

        if (data.resumePosition) {
          resumePosition.value = data.resumePosition;
          showResumePrompt.value = true;
        }

        notify({
          title: "Upload Failed",
          description: data.message || "Failed to seed cards",
          color: "error",
        });

        uploading.value = false;
      });

      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        eventSource.close();

        notify({
          title: "Connection Error",
          description: "Lost connection to the server",
          color: "error",
        });

        uploading.value = false;
        showProgress.value = false;
      };
    } catch (err) {
      console.error("Failed to initiate seeding:", err);

      notify({
        title: "Upload Failed",
        description:
          (err instanceof Error ? err.message : String(err)) ||
          "Could not start the seeding process",
        color: "error",
      });

      uploading.value = false;
      showProgress.value = false;
    }
  };

  const resumeUpload = () => {
    if (resumePosition.value) {
      uploadJsonFile(resumePosition.value);
      showResumePrompt.value = false;
    }
  };

  return {
    uploadState,
    uploading,
    showPreview,
    previewData,
    previewStats,
    uploadProgress,
    showProgress,
    seedingStats,
    resumePosition,
    showResumePrompt,
    handleFileChange,
    parseJsonFile,
    uploadJsonFile,
    resumeUpload,
  };
};
