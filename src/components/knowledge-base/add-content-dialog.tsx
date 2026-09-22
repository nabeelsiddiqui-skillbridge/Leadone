"use client";

import { useRef, useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createTextDocumentAction,
  createUrlDocumentAction,
  uploadFileDocumentAction,
  type ActionState,
} from "@/app/(app)/knowledge-base/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SUPPORTED_ACCEPT = ".txt,.csv,.pdf,.docx";

export function AddContentDialog({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("text");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  const textFormRef = useRef<HTMLFormElement>(null);
  const fileFormRef = useRef<HTMLFormElement>(null);
  const urlFormRef = useRef<HTMLFormElement>(null);

  function afterSuccess(formRef: RefObject<HTMLFormElement | null>) {
    formRef.current?.reset();
    setFileName(null);
    setOpen(false);
    router.refresh();
  }

  function submit(
    action: (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    formData: FormData,
    formRef: RefObject<HTMLFormElement | null>
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Document added.");
      afterSuccess(formRef);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setFileName(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add content
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add content</DialogTitle>
          <DialogDescription>
            Add a document to this knowledge base. It's chunked and embedded automatically so agents can
            search it during calls.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <form
              ref={textFormRef}
              action={(formData) => submit(createTextDocumentAction, formData, textFormRef)}
              className="grid gap-4 pt-4"
            >
              <input type="hidden" name="knowledge_base_id" value={knowledgeBaseId} />
              <div className="grid gap-2">
                <Label htmlFor="text-name">Name</Label>
                <Input id="text-name" name="name" placeholder="Refund policy" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="text-content">Content</Label>
                <Textarea
                  id="text-content"
                  name="content"
                  placeholder="Paste or type the text your agent should be able to answer questions from…"
                  rows={8}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding…" : "Add document"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="file">
            <form
              ref={fileFormRef}
              action={(formData) => submit(uploadFileDocumentAction, formData, fileFormRef)}
              className="grid gap-4 pt-4"
            >
              <input type="hidden" name="knowledge_base_id" value={knowledgeBaseId} />
              <div className="grid gap-2">
                <Label htmlFor="file-name">Name (optional)</Label>
                <Input id="file-name" name="name" placeholder="Defaults to the file name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="file-file">File</Label>
                <input
                  id="file-file"
                  name="file"
                  type="file"
                  accept={SUPPORTED_ACCEPT}
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Supported: .txt, .csv, .pdf, .docx (max 20MB). {fileName ? `Selected: ${fileName}` : ""}
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Uploading…" : "Upload document"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="url">
            <form
              ref={urlFormRef}
              action={(formData) => submit(createUrlDocumentAction, formData, urlFormRef)}
              className="grid gap-4 pt-4"
            >
              <input type="hidden" name="knowledge_base_id" value={knowledgeBaseId} />
              <div className="grid gap-2">
                <Label htmlFor="url-name">Name (optional)</Label>
                <Input id="url-name" name="name" placeholder="Defaults to the page URL" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url-url">URL</Label>
                <Input id="url-url" name="url" type="url" placeholder="https://example.com/faq" required />
                <p className="text-xs text-muted-foreground">
                  The page is fetched and stripped down to its readable text.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Fetching…" : "Add document"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
