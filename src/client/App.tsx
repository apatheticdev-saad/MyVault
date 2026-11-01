import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, ArrowDownToLine, Check, ChevronDown, Cloud, File, FileAudio, FileImage, FileText, FileVideo, Folder, FolderPlus, HardDrive, Heart, Clock3, Image as ImageIcon, LayoutGrid, List, LockKeyhole, LogOut, Menu, Moon, MoreHorizontal, Search, Settings, ShieldCheck, Sun, Trash2, UploadCloud, X } from "lucide-react";
import { api, contentUrl, type VaultFile } from "./lib/api";
import "./settings.css";
type Toast = {
    id: number;
    message: string;
    type: "success" | "error";
};
const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
const fileDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const iconFor = (file: VaultFile) => file.isFolder ? Folder : file.mimeType.startsWith("image/") ? FileImage : file.mimeType.startsWith("video/") ? FileVideo : file.mimeType.startsWith("audio/") ? FileAudio : file.mimeType.includes("pdf") || file.mimeType.includes("document") ? FileText : File;
export default function App() {
    const [initialized, setInitialized] = useState<boolean | null>(null);
    const [pinLength, setPinLength] = useState(6);
    const [authenticated, setAuthenticated] = useState(false);
    const [pin, setPin] = useState("");
    const [loginBusy, setLoginBusy] = useState(false);
    const [files, setFiles] = useState<VaultFile[]>([]);
    const [folderStack, setFolderStack] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [rootFolderId, setRootFolderId] = useState("");
    const [driveConnected, setDriveConnected] = useState(false);
    const [storage, setStorage] = useState<{
        limit: number;
        usage: number;
        usageInDrive: number;
    } | null>(null);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "modified" | "size" | "type">("name");
    const [fileFilter, setFileFilter] = useState<"all" | "folders" | "files" | "images" | "videos" | "audio" | "pdf" | "documents">("all");
    const [view, setView] = useState<"grid" | "list">("grid");
    const [activeNav, setActiveNav] = useState("My files");
    const [dark, setDark] = useState(() => localStorage.getItem("mv-theme") !== "light");
    const [mobileMenu, setMobileMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showFolderDialog, setShowFolderDialog] = useState(false);
    const [folderName, setFolderName] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
    const [settingsData, setSettingsData] = useState<{authMode:string;pinLength:number;driveConnected:boolean;activeSessions:number}|null>(null);
    const [changePinOpen, setChangePinOpen] = useState(false);
    const [currentPinValue, setCurrentPinValue] = useState("");
    const [recoveryKeyValue, setRecoveryKeyValue] = useState("");
    const [newPinValue, setNewPinValue] = useState("");
    const [confirmPinValue, setConfirmPinValue] = useState("");
    const [newPinLength, setNewPinLength] = useState<4 | 6>(4);
    const [changePinBusy, setChangePinBusy] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const toast = useCallback((message: string, type: Toast["type"] = "success") => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, message, type }]);
        window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3500);
    }, []);
    const loadFiles = useCallback(async (folderId?: string) => {
        setLoading(true);
        try {
            const result = await api.files(folderId);
            setFiles(result.files);
            setRootFolderId(result.rootFolderId);
            setDriveConnected(true);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Could not load files.";
            if (message.includes("Connect your storage"))
                setDriveConnected(false);
            else
                toast(message, "error");
        }
        finally {
            setLoading(false);
        }
    }, [toast]);
    const loadSpecial = useCallback(async (section: string) => {
        setLoading(true);
        try {
            const result = section === "Favorites" ? await api.favorites() : section === "Recent" ? await api.recent() : await api.trashList();
            setFiles(result.files);
            if (section === "Favorites") setFavoriteIds(result.files.map(f => f.id));
        } catch (error) { toast(error instanceof Error ? error.message : `Could not load ${section.toLowerCase()}.`, "error"); }
        finally { setLoading(false); }
    }, [toast]);
    const toggleFavorite = async (file: VaultFile) => {
        try {
            const result = await api.toggleFavorite(file.id);
            setFavoriteIds(current => result.favorite ? [...current, file.id] : current.filter(id => id !== file.id));
            if (activeNav === "Favorites" && !result.favorite) setFiles(current => current.filter(item => item.id !== file.id));
            toast(result.favorite ? "Added to Favorites." : "Removed from Favorites.");
        } catch (error) { toast(error instanceof Error ? error.message : "Could not update favorite.", "error"); }
    };
    const restoreFile = async (file: VaultFile) => {
        try { await api.restore(file.id); setFiles(current => current.filter(item => item.id !== file.id)); toast("Item restored."); }
        catch (error) { toast(error instanceof Error ? error.message : "Could not restore item.", "error"); }
    };
    const permanentlyDelete = async (file: VaultFile) => {
        if (!window.confirm(`Permanently delete “${file.name}”? This cannot be undone.`)) return;
        try { await api.permanentlyDelete(file.id); setFiles(current => current.filter(item => item.id !== file.id)); toast("Permanently deleted."); }
        catch (error) { toast(error instanceof Error ? error.message : "Could not permanently delete item.", "error"); }
    };
    const refreshSettings = async () => { try { setSettingsData(await api.settings()); } catch { setSettingsData(null); } };
    async function submitPinChange(event: FormEvent) {
        event.preventDefault();
        if (changePinBusy) return;
        if (!new RegExp(`^\\d{${newPinLength}}$`).test(newPinValue)) {
            toast(`New PIN must contain exactly ${newPinLength} digits.`, "error");
            return;
        }
        if (newPinValue !== confirmPinValue) {
            toast("The new PIN entries do not match.", "error");
            return;
        }
        setChangePinBusy(true);
        try {
            await api.changePin(currentPinValue, recoveryKeyValue.trim(), newPinValue, newPinLength);
            setPinLength(newPinLength);
            setCurrentPinValue("");
            setRecoveryKeyValue("");
            setNewPinValue("");
            setConfirmPinValue("");
            setChangePinOpen(false);
            setSettingsOpen(false);
            setAuthenticated(false);
            setFiles([]);
            setPin("");
            toast("PIN changed. All sessions were signed out; unlock MyVault with your new PIN.");
        } catch (error) {
            toast(error instanceof Error ? error.message : "Could not change PIN.", "error");
        } finally {
            setChangePinBusy(false);
        }
    }
    const refreshStorage = useCallback(async () => {
        try {
            setStorage(await api.storage());
        }
        catch {
            setStorage(null);
        }
    }, []);
    const boot = useCallback(async () => {
        try {
            const status = await api.authStatus();
            setInitialized(status.initialized);
            setPinLength(status.pinLength);
            if (!status.initialized)
                return;
            try {
                await api.me();
                setAuthenticated(true);
                const drive = await api.driveStatus();
                setDriveConnected(drive.connected);
                if (drive.connected) {
                    await loadFiles();
                    await refreshStorage();
                }
            }
            catch {
                setAuthenticated(false);
            }
        }
        catch {
            toast("Unable to reach MyVault backend.", "error");
        }
    }, [loadFiles, refreshStorage, toast]);
    useEffect(() => { void boot(); }, [boot]);
    useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("mv-theme", dark ? "dark" : "light"); }, [dark]);
    useEffect(() => {
        const handleSearchShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                document.querySelector<HTMLInputElement>('input[aria-label="Search files in this folder"]')?.focus();
            }
            if (event.key === "Escape" && search) setSearch("");
        };
        window.addEventListener("keydown", handleSearchShortcut);
        return () => window.removeEventListener("keydown", handleSearchShortcut);
    }, [search]);
    // Load favorite IDs independently from the file browser. Keeping this out of
    // loadFiles prevents an extra Favorites request on every folder navigation.
    useEffect(() => {
        if (!authenticated || !driveConnected) return;
        let cancelled = false;
        void api.favorites()
            .then((result) => {
                if (!cancelled) setFavoriteIds(result.files.map((file) => file.id));
            })
            .catch(() => {
                // Favorites are optional; the file browser should remain usable.
            });
        return () => { cancelled = true; };
    }, [authenticated, driveConnected]);

    useEffect(() => {
        if (!authenticated || !driveConnected) return;
        if (["Favorites", "Recent", "Trash"].includes(activeNav)) {
            // Do not setFolderStack([]) here: creating a fresh array on every
            // effect run changes a dependency and causes an infinite render loop.
            void loadSpecial(activeNav);
        } else if (["My files", "Photos", "Videos", "Documents"].includes(activeNav)) {
            void loadFiles(folderStack.at(-1)?.id);
        }
    }, [folderStack, authenticated, driveConnected, activeNav, loadFiles, loadSpecial]);
    useEffect(() => { if (settingsOpen) void refreshSettings(); }, [settingsOpen]);
    const visibleFiles = useMemo(() => {
        let items = files;
        if (activeNav === "Photos")
            items = items.filter((file) => file.mimeType.startsWith("image/"));
        if (activeNav === "Videos")
            items = items.filter((file) => file.mimeType.startsWith("video/"));
        if (activeNav === "Documents")
            items = items.filter((file) => file.mimeType.includes("pdf") || file.mimeType.includes("document") || file.mimeType.includes("text") || file.mimeType.includes("spreadsheet"));
        const query = search.trim().toLocaleLowerCase();
        if (query)
            items = items.filter((file) => file.name.toLocaleLowerCase().includes(query));
        if (fileFilter === "folders") items = items.filter((file) => file.isFolder);
        if (fileFilter === "files") items = items.filter((file) => !file.isFolder);
        if (fileFilter === "images") items = items.filter((file) => file.mimeType.startsWith("image/"));
        if (fileFilter === "videos") items = items.filter((file) => file.mimeType.startsWith("video/"));
        if (fileFilter === "audio") items = items.filter((file) => file.mimeType.startsWith("audio/"));
        if (fileFilter === "pdf") items = items.filter((file) => file.mimeType.includes("pdf"));
        if (fileFilter === "documents") items = items.filter((file) => !file.isFolder && (file.mimeType.includes("document") || file.mimeType.includes("text") || file.mimeType.includes("spreadsheet") || file.mimeType.includes("presentation")));
        return [...items].sort((a, b) => {
            if (a.isFolder !== b.isFolder) return Number(b.isFolder) - Number(a.isFolder);
            if (sortBy === "modified") return new Date(b.modifiedTime || 0).getTime() - new Date(a.modifiedTime || 0).getTime();
            if (sortBy === "size") return (b.size || 0) - (a.size || 0);
            if (sortBy === "type") return a.mimeType.localeCompare(b.mimeType) || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        });
    }, [files, activeNav, search, sortBy, fileFilter]);
    async function submitPin(event?: FormEvent) {
        event?.preventDefault();
        if (pin.length !== pinLength || loginBusy)
            return;
        setLoginBusy(true);
        try {
            await api.login(pin);
            setAuthenticated(true);
            setPin("");
            toast("Welcome back.");
            const drive = await api.driveStatus();
            setDriveConnected(drive.connected);
            if (drive.connected) {
                await loadFiles();
                await refreshStorage();
            }
        }
        catch (error) {
            setPin("");
            toast(error instanceof Error ? error.message : "Unable to unlock MyVault.", "error");
        }
        finally {
            setLoginBusy(false);
        }
    }
    async function logout() {
        try {
            await api.logout();
        }
        finally {
            setAuthenticated(false);
            setFiles([]);
            setFolderStack([]);
            setDriveConnected(false);
            toast("You have been logged out.");
        }
    }
    async function connectDrive() {
        try {
            const result = await api.driveConnect();
            window.location.assign(result.url);
        }
        catch (error) {
            toast(error instanceof Error ? error.message : "Could not connect your storage.", "error");
        }
    }
    async function uploadFiles(selected: FileList | null) {
        if (!selected?.length)
            return;
        setUploading(true);
        setUploadProgress(0);
        const items = Array.from(selected);
        let completed = 0;
        try {
            for (const file of items) {
                const session = await api.initUpload(file, folderStack.at(-1)?.id || rootFolderId || undefined);
                const chunkSize = session.chunkSize;
                let offset = 0;
                while (offset < file.size) {
                    const end = Math.min(offset + chunkSize, file.size);
                    const chunk = file.slice(offset, end);
                    const result = await api.uploadChunk(session.uploadId, chunk, offset, end, file.size);
                    offset = end;
                    setUploadProgress(Math.round(((completed + offset / Math.max(file.size, 1)) / items.length) * 100));
                    if (result.complete)
                        break;
                }
                completed += 1;
            }
            toast(`${items.length} file${items.length === 1 ? "" : "s"} uploaded successfully.`);
            await loadFiles(folderStack.at(-1)?.id);
            await refreshStorage();
        }
        catch (error) {
            toast(error instanceof Error ? error.message : "Upload failed. Try again.", "error");
        }
        finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInput.current)
                fileInput.current.value = "";
        }
    }
    async function createFolder(event: FormEvent) {
        event.preventDefault();
        try {
            await api.createFolder(folderName, folderStack.at(-1)?.id || rootFolderId || undefined);
            setFolderName("");
            setShowFolderDialog(false);
            await loadFiles(folderStack.at(-1)?.id);
            toast("Folder created.");
        }
        catch (error) {
            toast(error instanceof Error ? error.message : "Could not create folder.", "error");
        }
    }
    async function renameFile(file: VaultFile) {
        const next = window.prompt("Rename file", file.name);
        if (!next || next.trim() === file.name)
            return;
        try {
            await api.rename(file.id, next.trim());
            await loadFiles(folderStack.at(-1)?.id);
            toast("Renamed successfully.");
        }
        catch (error) {
            toast(error instanceof Error ? error.message : "Rename failed.", "error");
        }
    }
    async function moveToTrash(file: VaultFile) {
        if (!window.confirm(`Move “${file.name}” to trash?`))
            return;
        try {
            await api.trash(file.id);
            await loadFiles(folderStack.at(-1)?.id);
            await refreshStorage();
            toast("File moved to trash.");
        }
        catch (error) {
            toast(error instanceof Error ? error.message : "Could not delete file.", "error");
        }
    }
    function openFolder(file: VaultFile) { setFolderStack((current) => [...current, { id: file.id, name: file.name }]); setActiveNav("My files"); }
    async function openFile(file: VaultFile) { try { await api.trackRecent(file.id); } catch { /* Recent history is best-effort. */ } setSelectedFile(file); }
    function navigateTo(index: number) { setFolderStack((current) => current.slice(0, index)); }
    const usedPercent = storage?.limit ? Math.min(100, (storage.usage / storage.limit) * 100) : 0;
    if (initialized === null)
        return <div className="boot-screen"><div className="brand-mark"><Cloud size={24}/></div><span>Preparing your private space…</span></div>;
    if (!initialized)
        return <main className="setup-screen"><div className="login-card"><div className="brand-mark"><Cloud size={26}/></div><p className="eyebrow">FIRST-TIME SETUP</p><h1>MyVault is not initialized</h1><p className="muted">The owner setup is intentionally performed through a private command-line setup step. This prevents someone who discovers the website from claiming the vault.</p><div className="notice"><ShieldCheck size={18}/><span>Run the owner initialization command from your private project environment. See <code>README.md</code>.</span></div></div></main>;
    if (!authenticated)
        return <main className="login-screen"><div className="login-card"><div className="brand-mark"><Cloud size={26}/></div><p className="eyebrow">YOUR PERSONAL CLOUD</p><h1>Welcome to MyVault</h1><p className="muted">Enter your private PIN to access your files.</p><form onSubmit={submitPin}><label className="field-label" htmlFor="pin">{pinLength}-digit PIN</label><input id="pin" className="pin-input" type="password" inputMode="numeric" autoComplete="current-password" maxLength={pinLength} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, pinLength))} autoFocus placeholder={'• '.repeat(pinLength).trim()}/><button className="primary-button full-button" disabled={pin.length !== pinLength || loginBusy}>{loginBusy ? "Unlocking…" : "Unlock MyVault"}<ArrowDownToLine size={17}/></button></form><div className="login-foot"><LockKeyhole size={14}/> Private access · Secure session</div></div><span className="login-version">MYVAULT · PERSONAL CLOUD</span></main>;
    return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><div className="brand-mark small"><Cloud size={20}/></div><div><strong>MyVault</strong><span>PERSONAL CLOUD</span></div><button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="upload-button" disabled={!driveConnected} onClick={() => fileInput.current?.click()}><UploadCloud size={17}/> Upload files</button>
      <nav className="nav-group"><span className="nav-caption">WORKSPACE</span>{[{ name: "My files", icon: HardDrive }, { name: "Photos", icon: ImageIcon }, { name: "Videos", icon: FileVideo }, { name: "Documents", icon: FileText }, { name: "Favorites", icon: Heart }, { name: "Recent", icon: Clock3 }, { name: "Trash", icon: Trash2 }].map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${activeNav === name ? "active" : ""}`} onClick={() => { setActiveNav(name); setFolderStack([]); setSearch(""); setMobileMenu(false); }}><Icon size={17}/>{name}</button>)}</nav>
      <div className="sidebar-spacer"/><div className="storage-card"><div className="storage-heading"><span>Storage</span><HardDrive size={15}/></div><div className="storage-track"><span style={{ width: `${usedPercent}%` }}/></div><strong>{storage ? `${formatBytes(storage.usage)} used` : "Connect storage"}</strong><span className="storage-sub">{storage?.limit ? `${formatBytes(storage.limit)} total account quota` : "Your available storage"}</span></div>
      <nav className="nav-group bottom-nav"><button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings size={17}/>Settings</button><button className="nav-item" onClick={logout}><LogOut size={17}/>Log out</button></nav>
      <div className="sidebar-profile"><div className="profile-avatar">M</div><div><strong>My private vault</strong><span>Owner space</span></div><ShieldCheck size={16} className="profile-shield"/></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={16}/><input aria-label="Search files in this folder" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this folder…"/>{search && <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={14}/></button>}<kbd>⌘ K</kbd></label><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="avatar-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">M</button></div></header>
      <div className="content-wrap"><section className="welcome-row"><div><p className="eyebrow">YOUR SPACE, EVERYWHERE</p><h1>{activeNav === "My files" ? "All your files." : activeNav + "."}</h1><p className="muted">A calm, private place for everything you want to keep.</p></div><div className="welcome-actions"><button className="secondary-button" onClick={() => setShowFolderDialog(true)}><FolderPlus size={16}/> New folder</button><button className="primary-button" onClick={() => fileInput.current?.click()}><UploadCloud size={16}/> Upload</button></div></section>
      {!driveConnected ? <section className="connect-card"><div className="connect-icon"><Cloud size={25}/></div><div className="connect-copy"><h2>Connect your storage</h2><p>Connect your storage provider once. Your files will appear here inside your private MyVault workspace.</p><span className="secure-note"><ShieldCheck size={14}/> Your storage authorization stays on the server.</span></div><button className="primary-button" onClick={connectDrive}>Connect storage <ArrowDownToLine size={16}/></button></section> : <>
        <section className="stats-grid"><div className="stat-card"><div className="stat-icon violet"><HardDrive size={18}/></div><span>Connected account used</span><strong>{storage ? formatBytes(storage.usage) : "—"}</strong><small>{storage?.limit ? `${formatBytes(storage.limit)} total account quota` : "Connected account storage"}</small></div><div className="stat-card"><div className="stat-icon blue"><File size={18}/></div><span>Files in this view</span><strong>{files.filter(f => !f.isFolder).length}</strong><small>Stored in your private vault</small></div><div className="stat-card"><div className="stat-icon green"><Folder size={18}/></div><span>Folders</span><strong>{files.filter(f => f.isFolder).length}</strong><small>Keep things organized</small></div></section>
        <section className="files-section"><div className="section-heading"><div><div className="folder-breadcrumb"><button onClick={() => navigateTo(0)}>My files</button>{folderStack.map((folder, index) => <span key={folder.id}><span className="crumb-slash">/</span><button onClick={() => navigateTo(index + 1)}>{folder.name}</button></span>)}</div><h2>{activeNav === "My files" ? "Your files" : activeNav}</h2></div><div className="view-controls"><span>{visibleFiles.length} {visibleFiles.length === 1 ? "item" : "items"}</span><label className="sort-control"><span>Filter</span><select aria-label="Filter files" value={fileFilter} onChange={(event) => setFileFilter(event.target.value as typeof fileFilter)}><option value="all">All items</option><option value="folders">Folders</option><option value="files">Files</option><option value="images">Images</option><option value="videos">Videos</option><option value="audio">Audio</option><option value="pdf">PDFs</option><option value="documents">Documents</option></select></label><label className="sort-control"><span>Sort</span><select aria-label="Sort files" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="name">Name</option><option value="modified">Last modified</option><option value="size">File size</option><option value="type">File type</option></select></label><button className={`view-button ${view === "grid" ? "selected" : ""}`} onClick={() => setView("grid")} aria-label="Grid view"><LayoutGrid size={16}/></button><button className={`view-button ${view === "list" ? "selected" : ""}`} onClick={() => setView("list")} aria-label="List view"><List size={17}/></button></div></div>
        {loading ? <div className="empty-state"><div className="spinner"/><span>Loading your files…</span></div> : visibleFiles.length === 0 ? <div className="empty-state"><div className="empty-icon"><Archive size={24}/></div><h3>{search || fileFilter !== "all" ? "No matching items" : "Your space is ready"}</h3><p>{search || fileFilter !== "all" ? "Try a different search or filter, or clear them to see everything in this folder." : "Upload your first file or create a folder to get started."}</p><button className="secondary-button" onClick={() => fileInput.current?.click()}><UploadCloud size={16}/> Upload a file</button></div> : <div className={view === "grid" ? "file-grid" : "file-list"}>
          {visibleFiles.map((file) => {
            const Icon = iconFor(file);
            return <article key={file.id} className={`file-card ${view === "list" ? "list-card" : ""}`}>
              <button className="file-main" onClick={() => file.isFolder ? openFolder(file) : void openFile(file)}>
                <div className={`file-preview ${file.isFolder ? "folder-preview" : ""}`}>{file.mimeType.startsWith("image/") ? <img src={contentUrl(file)} alt="" loading="lazy"/> : <Icon size={27}/>}</div>
                <div className="file-info"><strong title={file.name}>{file.name}</strong><span>{file.isFolder ? "Folder" : formatBytes(file.size)}{!file.isFolder ? ` · ${fileDate(file.modifiedTime)}` : ""}</span></div>
              </button>
              <div className="file-actions">
                {activeNav !== "Trash" && <button className="icon-button small-icon" onClick={() => void toggleFavorite(file)} aria-label={favoriteIds.includes(file.id) ? "Remove from favorites" : "Add to favorites"} title={favoriteIds.includes(file.id) ? "Remove from favorites" : "Add to favorites"}><Heart size={16} fill={favoriteIds.includes(file.id) ? "currentColor" : "none"}/></button>}
                {activeNav === "Trash" ? <><button className="secondary-button" onClick={() => void restoreFile(file)}>Restore</button><button className="icon-button small-icon danger-text" onClick={() => void permanentlyDelete(file)} aria-label="Permanently delete"><Trash2 size={16}/></button></> : <>
                  <button className="icon-button small-icon" onClick={() => file.isFolder ? openFolder(file) : window.open(contentUrl(file, true), "_blank", "noopener,noreferrer")} aria-label={file.isFolder ? "Open folder" : "Download file"}>{file.isFolder ? <ChevronDown size={16}/> : <ArrowDownToLine size={16}/>}</button>
                  <div className="menu-wrap"><button className="icon-button small-icon" onClick={(event) => { const menu = event.currentTarget.nextElementSibling as HTMLElement | null; if (menu) menu.hidden = !menu.hidden; }} aria-label="More options"><MoreHorizontal size={17}/></button><div className="context-menu" hidden><button onClick={() => void renameFile(file)}>Rename</button><button className="danger-text" onClick={() => void moveToTrash(file)}>Move to trash</button></div></div>
                </>}
              </div>
            </article>;
          })}
        </div>}
        </section></>}
      <footer className="app-footer"><span><span className="status-dot"/> Your vault is private</span><span>MyVault · Built for your devices</span></footer></div>
    </main>
    <input ref={fileInput} type="file" multiple hidden onChange={(event) => void uploadFiles(event.target.files)}/>
    {uploading && <div className="upload-toast"><div className="upload-toast-top"><span><UploadCloud size={16}/> Uploading files</span><strong>{uploadProgress}%</strong></div><div className="storage-track"><span style={{ width: `${uploadProgress}%` }}/></div></div>}
    {showFolderDialog && <div className="modal-backdrop" onClick={() => setShowFolderDialog(false)}><form className="modal-card" onSubmit={createFolder} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">ORGANIZE</p><h2>Create folder</h2></div><button type="button" className="icon-button" onClick={() => setShowFolderDialog(false)}><X size={18}/></button></div><label className="field-label">Folder name</label><input className="text-input" autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={120} placeholder="e.g. College documents"/><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowFolderDialog(false)}>Cancel</button><button className="primary-button" disabled={!folderName.trim()}>Create folder</button></div></form></div>}
    {selectedFile && <div className="modal-backdrop preview-backdrop" onClick={() => setSelectedFile(null)}><div className="preview-modal" onClick={(event) => event.stopPropagation()}><div className="preview-toolbar"><strong>{selectedFile.name}</strong><div><a className="secondary-button link-button" href={contentUrl(selectedFile, true)} target="_blank" rel="noreferrer"><ArrowDownToLine size={15}/> Download</a><button className="icon-button" onClick={() => setSelectedFile(null)}><X size={18}/></button></div></div>{selectedFile.mimeType.startsWith("image/") ? <img src={contentUrl(selectedFile)} alt={selectedFile.name}/> : selectedFile.mimeType.startsWith("video/") ? <video src={contentUrl(selectedFile)} controls/> : selectedFile.mimeType.startsWith("audio/") ? <audio src={contentUrl(selectedFile)} controls/> : selectedFile.mimeType.includes("pdf") ? <iframe src={contentUrl(selectedFile)} title={selectedFile.name}/> : <div className="preview-unavailable"><FileText size={38}/><p>Preview isn't available for this file type.</p><a href={contentUrl(selectedFile, true)}>Download file</a></div>}</div></div>}
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><div className="modal-card settings-card" onClick={(event) => event.stopPropagation()}>
      <div className="modal-heading"><div><p className="eyebrow">MYVAULT CONTROL CENTER</p><h2>Settings</h2><p className="muted">Manage your vault preferences and account security.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></div>
      <div className="settings-section-label">PREFERENCES</div>
      <div className="settings-row"><div><strong>Appearance</strong><span>Your theme is saved on this device.</span></div><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={16}/> : <Moon size={16}/>} {dark ? "Light mode" : "Dark mode"}</button></div>
      <div className="settings-section-label">STORAGE</div>
      <div className="settings-row"><div><strong>Google Drive connection</strong><span>{driveConnected ? "Connected · Your files are stored in your Google Drive." : "Not connected · Connect a storage provider to use your vault."}</span></div><button className="secondary-button" onClick={() => void connectDrive()}>{driveConnected ? "Reconnect" : "Connect"}</button></div>
      {storage && <div className="settings-storage"><div className="settings-storage-meta"><span>Google account storage</span><strong>{formatBytes(storage.usage)} of {formatBytes(storage.limit)}</strong></div><div className="storage-track"><span style={{width:`${storage.limit > 0 ? Math.min(100, storage.usage / storage.limit * 100) : 0}%`}}/></div><span className="muted">Includes storage shared across Google services.</span></div>}
      <div className="settings-section-label">SECURITY</div>
      <div className="settings-row"><div><strong>Vault PIN</strong><span>{settingsData ? `${settingsData.pinLength}-digit PIN · ${settingsData.activeSessions} active session(s)` : "Loading security status…"}</span></div><ShieldCheck size={19}/></div>
            <div className="settings-row">
        <div>
          <strong>Recovery key</strong>
          <span>Replace your existing recovery key if it may have been exposed.</span>
        </div>
        <button className="secondary-button" onClick={async () => {
          const current = window.prompt("Enter your current MyVault PIN:");
          if (current === null) return;
          const oldKey = window.prompt("Enter your existing recovery key:");
          if (oldKey === null) return;
          try {
            const result = await api.rotateRecovery(current, oldKey.trim());
            window.alert("NEW RECOVERY KEY — SAVE IT OFFLINE. It will not be shown again:\n\n" + result.recoveryKey);
            toast("Recovery key replaced successfully.");
          } catch (error) {
            toast(error instanceof Error ? error.message : "Could not replace recovery key.", "error");
          }
        }}>Replace key</button>
      </div>
      <div className="settings-row"><div><strong>Change PIN</strong><span>Requires your current PIN and your offline recovery key. Changing it signs out all devices.</span></div><button className="secondary-button" onClick={() => { setNewPinLength((settingsData?.pinLength || pinLength) === 4 ? 4 : 6); setChangePinOpen(true); }}>Change PIN</button></div>
      <div className="settings-row"><div><strong>Sign out everywhere</strong><span>Immediately revoke all active MyVault sessions, including this device.</span></div><button className="secondary-button danger-text" onClick={async () => { if (!window.confirm("Sign out of every device? You will need your PIN to unlock MyVault again.")) return; try { await api.logoutAll(); setAuthenticated(false); setFiles([]); setPin(""); setSettingsOpen(false); toast("All MyVault sessions have been signed out."); } catch (error) { toast(error instanceof Error ? error.message : "Could not end sessions.", "error"); } }}>Sign out all</button></div>
      <div className="settings-footer"><button className="secondary-button" onClick={() => void logout()}><LogOut size={16}/> Log out this device</button><span>MyVault v0.1.0</span></div>
      <p className="settings-privacy-note"><LockKeyhole size={14}/> Your PIN and recovery key are verified by the MyVault server and are not saved in browser storage.</p>
    </div></div>}
    {changePinOpen && <div className="modal-backdrop" onClick={() => { if (!changePinBusy) setChangePinOpen(false); }}><form className="modal-card change-pin-card" onSubmit={submitPinChange} onClick={(event) => event.stopPropagation()}>
      <div className="modal-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Change your PIN</h2><p className="muted">For your protection, all devices will be signed out after the PIN changes.</p></div><button type="button" className="icon-button" onClick={() => setChangePinOpen(false)} aria-label="Close change PIN"><X size={18}/></button></div>
      <label className="field-label" htmlFor="current-vault-pin">Current PIN</label><input id="current-vault-pin" className="text-input" type="password" inputMode="numeric" autoComplete="current-password" maxLength={pinLength} value={currentPinValue} onChange={(event) => setCurrentPinValue(event.target.value.replace(/\D/g, "").slice(0, pinLength))} required placeholder={`${pinLength}-digit current PIN`}/>
      <label className="field-label" htmlFor="vault-recovery-key">Recovery key</label><input id="vault-recovery-key" className="text-input" type="password" autoComplete="off" value={recoveryKeyValue} onChange={(event) => setRecoveryKeyValue(event.target.value)} required placeholder="Enter the recovery key saved during setup"/>
      <label className="field-label" htmlFor="new-pin-length">New PIN length</label><select id="new-pin-length" className="text-input" value={newPinLength} onChange={(event) => { const length = Number(event.target.value) as 4 | 6; setNewPinLength(length); setNewPinValue(""); setConfirmPinValue(""); }}><option value={4}>4 digits</option><option value={6}>6 digits</option></select>
      <label className="field-label" htmlFor="new-vault-pin">New PIN</label><input id="new-vault-pin" className="text-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={newPinLength} value={newPinValue} onChange={(event) => setNewPinValue(event.target.value.replace(/\D/g, "").slice(0, newPinLength))} required placeholder={`${newPinLength}-digit new PIN`}/>
      <label className="field-label" htmlFor="confirm-vault-pin">Confirm new PIN</label><input id="confirm-vault-pin" className="text-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={newPinLength} value={confirmPinValue} onChange={(event) => setConfirmPinValue(event.target.value.replace(/\D/g, "").slice(0, newPinLength))} required placeholder="Re-enter your new PIN"/>
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={changePinBusy} onClick={() => setChangePinOpen(false)}>Cancel</button><button className="primary-button" disabled={changePinBusy || currentPinValue.length !== pinLength || !recoveryKeyValue.trim() || newPinValue.length !== newPinLength || confirmPinValue.length !== newPinLength}>{changePinBusy ? "Updating…" : "Update PIN"}</button></div>
    </form></div>}

    <div className="toast-stack">{toasts.map((item) => <div className={`toast ${item.type}`} key={item.id}>{item.type === "success" ? <Check size={16}/> : <X size={16}/>} {item.message}</div>)}</div>
  </div>;
}
