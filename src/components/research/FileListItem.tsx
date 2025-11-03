import { Button } from "@/components/ui/button";
import { Download, Trash2, ExternalLink } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface FileItem {
  type: "storage" | "link";
  storageId?: Id<"_storage">;
  name?: string;
  url?: string;
}

interface FileListItemProps {
  file: FileItem;
  index: number;
  onDelete: (index: number) => void;
}

export function FileListItem({ file, index, onDelete }: FileListItemProps) {
  const fileUrl = useQuery(
    api.kits.getFileUrl,
    file.type === "storage" && file.storageId ? { storageId: file.storageId } : "skip"
  );

  const handleDownload = () => {
    if (file.type === "link" && file.url) {
      window.open(file.url, "_blank");
    } else if (file.type === "storage" && fileUrl) {
      window.open(fileUrl, "_blank");
    }
  };

  const displayName = file.type === "link" ? file.name : `Uploaded file ${index + 1}`;

  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <span className="text-sm truncate flex-1">{displayName}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={handleDownload}>
          {file.type === "link" ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(index)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
