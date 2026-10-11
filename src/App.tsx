import {
  type Component,
  For,
  Show,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
} from "solid-js";
import { Button, buttonVariants } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import { Toaster, showToast } from "./components/ui/toast";
import {
  MdiBookOpenBlankVariantOutline,
  MdiClipboardTextOutline,
  MdiDelete,
  MdiGithub,
  MdiGitlab,
  MdiLaunch,
  MdiMinusBoxOutline,
  MdiPlusBoxOutline,
  MdiShareVariant,
} from "./icons";
import { instructions } from "./model";
import {
  type Book,
  type TocEntry,
  addBook,
  bindingError,
  books,
  catalogError,
  checkedExternal,
  clearExternals,
  deleteBook,
  drafts,
  error,
  externals,
  halted,
  initializeStore,
  loaded,
  loading,
  receipt,
  roomId,
  sync,
  toggleExternal,
  warning,
  writable,
} from "./store";

const TocHeader: Component<{ entry: TocEntry; book: Book; parents: string }> = (
  props,
) => {
  const id = createUniqueId();
  const onChange = () => {
    void toggleExternal(props.book, props.entry);
  };
  const checked = createMemo(() => checkedExternal(props.book, props.entry));

  return (
    <div class="flex flex-row items-center gap-1 py-1">
      <Checkbox
        id={id}
        onChange={onChange}
        checked={checked()}
        disabled={!writable() || !props.entry.external_url}
      />
      <Label for={`${id}-input`}>{props.entry.title}</Label>
      <Show when={props.entry.html_url}>
        <a
          // biome-ignore lint/style/noNonNullAssertion: already checked
          href={props.entry.html_url!}
          target="_blank"
          rel="noreferrer"
        >
          <MdiLaunch />
        </a>
      </Show>
    </div>
  );
};

const TocEntryItem: Component<{
  entry: TocEntry;
  book: Book;
  parents?: string;
}> = (props) => {
  const parents = createMemo(() =>
    props.parents
      ? `${props.parents} / ${props.entry.title}`
      : props.entry.title,
  );
  const [expanded, setExpanded] = createSignal(false);

  return (
    <li>
      <Show
        when={props.entry.children.length > 0}
        fallback={
          <TocHeader
            entry={props.entry}
            book={props.book}
            parents={parents()}
          />
        }
      >
        <Collapsible open={expanded()} onOpenChange={setExpanded}>
          <Show
            when={props.entry.html_url}
            fallback={
              <CollapsibleTrigger class="flex items-center gap-1">
                <div class="py-1">{props.entry.title}</div>
                <Show when={expanded()} fallback={<MdiPlusBoxOutline />}>
                  <MdiMinusBoxOutline />
                </Show>
              </CollapsibleTrigger>
            }
          >
            <div class="flex items-center gap-1">
              <TocHeader
                entry={props.entry}
                book={props.book}
                parents={parents()}
              />
              <CollapsibleTrigger>
                <Show when={expanded()} fallback={<MdiPlusBoxOutline />}>
                  <MdiMinusBoxOutline />
                </Show>
              </CollapsibleTrigger>
            </div>
          </Show>
          <CollapsibleContent>
            <ol class="ml-4 list-inside">
              <For each={props.entry.children}>
                {(child) => (
                  <TocEntryItem
                    entry={child}
                    book={props.book}
                    parents={parents()}
                  />
                )}
              </For>
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </Show>
    </li>
  );
};

const ExternalCard: Component<{
  book: Book;
  entry: TocEntry;
  parents: string;
}> = (props) => {
  return (
    <li>
      {props.book.title} / {props.parents}
    </li>
  );
};

const BookCard: Component<{ book: Book }> = (props) => {
  return (
    <Card class="w-full sm:w-96">
      <CardHeader class="pb-2">
        <div class="flex flex-row items-start justify-between gap-1">
          <Show
            when={props.book.logo}
            fallback={<MdiBookOpenBlankVariantOutline class="size-16" />}
          >
            <img
              class="size-24 object-contain"
              src={props.book.logo}
              loading="lazy"
              alt={props.book.title}
            />
          </Show>
          <div class="flex flex-row gap-2">
            <a
              href={props.book.html_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Read online"
            >
              <MdiBookOpenBlankVariantOutline />
            </a>
            <a
              href={props.book.code_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View code"
            >
              <Show
                when={props.book.code_url.includes("github")}
                fallback={<MdiGitlab />}
              >
                <MdiGithub />
              </Show>
            </a>
            <Show when={props.book.deleteable}>
              <button
                type="button"
                disabled={!writable()}
                aria-label={`Remove ${props.book.title}`}
                onClick={() => {
                  void deleteBook(props.book);
                }}
              >
                <MdiDelete />
              </button>
            </Show>
          </div>
        </div>
        <CardTitle class="text-xl">{props.book.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="mb-2 text-sm">{props.book.author}</p>
        <p class="mb-3 text-sm">
          <a
            class="underline"
            href={props.book.license_url}
            target="_blank"
            rel="noreferrer"
          >
            {props.book.license}
          </a>
          {" · "}
          <a
            class="underline"
            href={props.book.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Catalogue source
          </a>
        </p>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Chapters</CollapsibleTrigger>
          <CollapsibleContent>
            <ol class="ml-4 list-inside">
              <For each={props.book.toc.children}>
                {(entry) => <TocEntryItem entry={entry} book={props.book} />}
              </For>
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

const InstructionActions: Component = () => {
  return (
    <>
      <h2 class="py-4 text-2xl">Actions</h2>
      <div class="flex flex-col items-start gap-2 sm:px-4">
        <Dialog>
          <DialogTrigger
            as={Button<"button">}
            variant="default"
            class="h-auto min-h-10 w-full whitespace-normal py-2"
          >
            Mail someone instructions to incorporate these chapters
          </DialogTrigger>
          <DialogContent>
            <MailInstructions />
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger
            as={Button<"button">}
            variant="outline"
            class="h-auto min-h-10 w-full whitespace-normal py-2"
          >
            Show how do it yourself instructions
          </DialogTrigger>
          <DialogContent class="max-w-4xl">
            <DiyInstructions />
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          onClick={() => void clearExternals()}
          disabled={!writable()}
          class="w-full"
        >
          Clear selection
        </Button>
      </div>
    </>
  );
};

const MailInstructions: Component = () => {
  const text = createMemo(() => {
    const toc = instructions(externals());
    return `Please add the following chapters to the teach book, by copying below into "parts" section of the "book/_toc.yml" file:\n
${toc}\n
\n
`;
  });
  const mailto = createMemo(
    () =>
      `mailto:?subject=Add external teachbook chapters&body=${encodeURIComponent(text())}`,
  );

  async function copyText() {
    await navigator.clipboard.writeText(text());
    showToast({
      title: "Copied instructions to clipboard",
      variant: "success",
    });
  }
  return (
    <div class="mt-4">
      <h2 class="text-2xl">Mail instructions</h2>
      <ol class="list-inside list-decimal">
        <li>
          <a class={buttonVariants({ variant: "outline" })} href={mailto()}>
            Click to open your email client
          </a>{" "}
          or
          <Button variant="outline" class="mt-2" onClick={copyText}>
            Click to copy instructions to clipboard
          </Button>{" "}
          and paste into a new email
        </li>
        <li>Add recipient</li>
        <li>
          Adjust subject, so recipient knows in which teach book to make changes
        </li>
        <li>Send the email</li>
      </ol>
    </div>
  );
};

const DiyInstructions: Component = () => {
  const text = createMemo(() => instructions(externals()));
  async function copyText() {
    await navigator.clipboard.writeText(text());
    showToast({
      title: "Copied externals to clipboard",
      variant: "success",
    });
  }

  return (
    <div class="mt-4">
      <h2 class="text-2xl">Instructions</h2>
      <ol class="list-inside list-decimal">
        <li>
          <Button
            variant="ghost"
            onClick={copyText}
            class="inline-flex items-center justify-center rounded-md border font-medium text-sm ring-offset-background transition-colors hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 "
          >
            Copy <MdiClipboardTextOutline />
          </Button>{" "}
          the following text to clipboard:
          <pre class="my-4 max-w-3xl overflow-y-auto bg-gray-10 p-4">
            {text()}
          </pre>
        </li>
        <li>
          Paste it into <i>parts:</i> or <i>chapters:</i> section in the{" "}
          <i>book/_toc.yml</i> file of your teach book repository
        </li>
        <li>Commit and push the changes</li>
        <li>
          Wait for GitHub action workflow to deploy your teach book with the
          selected external chapters.
        </li>
      </ol>
    </div>
  );
};

function AddBookCard() {
  const [open, setOpen] = createSignal(false);
  const [raw, setRaw] = createSignal<unknown>();
  const [fileError, setFileError] = createSignal("");
  async function readFile(event: Event) {
    setFileError("");
    setRaw(undefined);
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Catalogue files must be smaller than 1 MB.");
      const value = JSON.parse(await file.text());
      if (Array.isArray(value) && value.length !== 1)
        throw new Error("Choose a catalogue containing one book.");
      setRaw(Array.isArray(value) ? value[0] : value);
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : String(caught));
    }
  }
  async function onSubmit(event: Event) {
    event.preventDefault();
    if (await addBook(raw())) {
      setOpen(false);
      setRaw(undefined);
    }
  }
  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <DialogTrigger
        as={Button<"button">}
        variant="outline"
        size="lg"
        class="h-80 w-full text-xl sm:w-96"
        disabled={!writable()}
      >
        Add a book
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div class="flex flex-col gap-4 py-4">
            <p>
              Import a harvested catalogue JSON containing one book, its chapter
              tree, author, source and licence. The book is saved to this shared
              House Room.
            </p>
            <p class="text-sm">
              Fetching a remote website or repository is not available in this
              House port. Remote images are omitted.{" "}
              <a
                class="underline"
                href="./samples/manual.catalog.json"
                download
              >
                Download the licensed catalogue example
              </a>
              .
            </p>
            <label for="catalogue-file">Catalogue JSON</label>
            <input
              id="catalogue-file"
              type="file"
              accept=".json,application/json"
              required
              onChange={(event) => void readFile(event)}
            />
            <Show when={fileError()}>
              <p role="alert">{fileError()}</p>
            </Show>
            <Show when={error()}>
              <p role="alert">{error()}</p>
            </Show>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!raw() || !writable()}>
              Add a book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const App: Component = () => {
  let stop: (() => void) | undefined;
  let disposed = false;
  onMount(async () => {
    const cleanup = await initializeStore();
    if (disposed) cleanup();
    else stop = cleanup;
  });
  onCleanup(() => {
    disposed = true;
    stop?.();
  });

  return (
    <div class="w-full px-4">
      <div>
        <h1 class="py-4 text-3xl">Teachbook recombiner</h1>
        <p>
          Select chapters from the available teach books to incorporate into
          your own teach book. Click <MdiPlusBoxOutline class="inline" /> to see
          chapters in books.
        </p>
      </div>
      <section aria-label="Notices">
        <Show when={sync()}>
          <p role="alert">{sync()}</p>
        </Show>
        <Show when={receipt()}>
          <p class="text-sm">{receipt()}</p>
        </Show>
        <Show when={halted()}>
          <p role="alert">
            House has paused writes. Your changes can still be saved locally
            and wait in the queue until provider writes resume.
          </p>
        </Show>
        <Show when={warning()}>
          <p role="alert">{warning()}</p>
        </Show>
        <Show when={error() || catalogError()}>
          <p role="alert">{error() || catalogError()}</p>
        </Show>
        <Show when={loading()}>
          <output>Loading…</output>
        </Show>
        <Show when={bindingError()}>
          <p role="alert">{bindingError()}</p>
        </Show>
        <Show
          when={drafts().filter((draft) => draft.room === roomId()).length > 0}
        >
          <details>
            <summary>Unfinished or returned drafts: review in House</summary>
            <ul class="list-inside list-disc">
              <For each={drafts().filter((draft) => draft.room === roomId())}>
                {(draft) => (
                  <li>
                    {draft.path}:{" "}
                    {JSON.stringify(draft.returned ?? "Unfinished draft")}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </Show>
      </section>
      <div class="flex w-full flex-col gap-4 lg:flex-row">
        <div class="w-full lg:w-1/3">
          <h2 class="py-4 text-2xl">Selected chapters</h2>
          <ul class="list-inside list-disc">
            <For each={externals()}>
              {(external) => (
                <ExternalCard
                  book={external.book}
                  entry={external.entry}
                  parents={external.parents}
                />
              )}
            </For>
          </ul>
          <Show
            when={externals().length > 0}
            fallback={<p>No teach book chapters have been selected.</p>}
          >
            <InstructionActions />
          </Show>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="pb-2 text-2xl">
            Available teach books{" "}
            <Dialog>
              <DialogTrigger
                aria-label="Share this catalogue"
                class="inline-flex"
              >
                <MdiShareVariant class="inline" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Shared catalogue</DialogTitle>
                </DialogHeader>
                <p>
                  The books and selected chapters are saved in the selected
                  House Room. Use House's Room sharing controls to give others
                  access. Sharing a link to this App does not grant Room access.
                </p>
              </DialogContent>
            </Dialog>
          </h2>
          <Show when={loaded() && books().length === 0 && !catalogError()}>
            <p class="mb-4">
              This Room has no books yet. Add a licensed catalogue to begin.
            </p>
          </Show>
          <div class="flex flex-row flex-wrap gap-2">
            <For each={books()}>{(book) => <BookCard book={book} />}</For>
            <AddBookCard />
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default App;
