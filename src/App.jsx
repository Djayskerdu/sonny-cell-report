import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, UserCircle2, Plus, X, Pencil, Trash2, MapPin,
  Loader2, RefreshCw, AlertCircle, ChevronRight, UserPlus,
  Home, Circle, Calendar, Clock, FileText, ArrowUpRight, ZoomIn,
  Camera, Check, Move, Eye
} from "lucide-react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAzO7jPP0gzGS2soah3AVCIXLFMwtxVMHc37gqHRJZPQm1Dcvpd3-SLOOF0V6wQRjkGg/exec";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const TRACKS = [
  { key:"SUYNL",       label:"SUYNL"         },
  { key:"LIFECLASS",   label:"Life Class"     },
  { key:"ENCOUNTER",   label:"Encounter"      },
  { key:"WATERBAPTISM",label:"Water Baptism"  },
  { key:"SOL1",        label:"SOL 1"          },
  { key:"SOL2",        label:"SOL 2"          },
  { key:"REENCOUNTER", label:"Re-Encounter"   },
  { key:"SOL3",        label:"SOL 3"          },
  { key:"LGLEADER",    label:"LG Leader"      },
];

const NETWORK_LEADERS = {
  Boys:  "Sonny Claudio",
  Girls: "",
};

function toBool(v) {
  return v === true || v === "TRUE" || v === "true" || v === 1;
}

function trackCount(member) {
  return TRACKS.filter(t => toBool(member[t.key])).length;
}

function isLGLeader(member) {
  return toBool(member.LGLEADER);
}

function fileToRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't decode image"));
      img.onload  = () => resolve({ dataUrl: reader.result, img });
      img.src      = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function cropImageToDataUrl(img, crop, maxDim = 480, quality = 0.82) {
  const srcX = Math.round(crop.x * img.naturalWidth);
  const srcY = Math.round(crop.y * img.naturalHeight);
  const srcW = Math.round(crop.w * img.naturalWidth);
  const srcH = Math.round(crop.h * img.naturalHeight);
  let dstW = srcW, dstH = srcH;
  if (dstW > dstH && dstW > maxDim) { dstH = Math.round(dstH * maxDim / dstW); dstW = maxDim; }
  else if (dstH >= dstW && dstH > maxDim) { dstW = Math.round(dstW * maxDim / dstH); dstH = maxDim; }
  const canvas = document.createElement("canvas");
  canvas.width = dstW; canvas.height = dstH;
  canvas.getContext("2d").drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
  return canvas.toDataURL("image/jpeg", quality);
}

// ════════════════════════════════════════════════════════════════════
//  CROP MODAL
// ════════════════════════════════════════════════════════════════════
function CropModal({ imgEl, onCrop, onCancel }) {
  const containerRef = useRef(null);
  const [box, setBox]       = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [previewUrl, setPreviewUrl] = useState("");
  const dragRef = useRef(null);

  useEffect(() => {
    if (!imgEl) return;
    const MAX = 600;
    let w = imgEl.naturalWidth, h = imgEl.naturalHeight;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(imgEl, 0, 0, w, h);
    setPreviewUrl(c.toDataURL("image/jpeg", 0.92));
    setBox({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  }, [imgEl]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width  - dragRef.current.startX;
    const dy = (e.clientY - rect.top)  / rect.height - dragRef.current.startY;
    const { type, startBox: s } = dragRef.current;
    let { x, y, w, h } = s;
    const MIN = 0.05;
    if (type === "move") {
      x = Math.max(0, Math.min(1 - w, s.x + dx));
      y = Math.max(0, Math.min(1 - h, s.y + dy));
    } else {
      if (type === "nw") { x = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); y = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); w = s.w+s.x-x; h = s.h+s.y-y; }
      if (type === "ne") { w = Math.max(MIN, Math.min(1-s.x, s.w+dx)); y = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); h = s.h+s.y-y; }
      if (type === "sw") { x = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); w = s.w+s.x-x; h = Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
      if (type === "se") { w = Math.max(MIN, Math.min(1-s.x, s.w+dx)); h = Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
      if (type === "n")  { y = Math.max(0, Math.min(s.y+s.h-MIN, s.y+dy)); h = s.h+s.y-y; }
      if (type === "s")  { h = Math.max(MIN, Math.min(1-s.y, s.h+dy)); }
      if (type === "e")  { w = Math.max(MIN, Math.min(1-s.x, s.w+dx)); }
      if (type === "w")  { x = Math.max(0, Math.min(s.x+s.w-MIN, s.x+dx)); w = s.w+s.x-x; }
    }
    setBox({ x, y, w, h });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup",   onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback((e, type) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      type,
      startX: (e.clientX - rect.left) / rect.width,
      startY: (e.clientY - rect.top)  / rect.height,
      startBox: { ...box },
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
  }, [box, onPointerMove, onPointerUp]);

  function handleCrop() {
    const dataUrl = cropImageToDataUrl(imgEl, box);
    onCrop(dataUrl);
  }

  if (!previewUrl) return null;

  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  const handleStyle = {
    position:"absolute", width:14, height:14,
    background:"#fff", border:"2px solid #22c55e",
    borderRadius:3, transform:"translate(-50%,-50%)", zIndex:3,
  };

  return (
    <div className="overlay crop-overlay" style={{zIndex:1100}}>
      <div className="modal crop-modal">
        <div className="modal-head">
          <h2 style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>✂️</span> Crop Photo
          </h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="crop-body" style={{padding:"0 22px 16px"}}>
          <p className="hint" style={{marginBottom:10}}>Drag the box or pull its edges to frame the photo. Then tap <strong>Use this crop</strong>.</p>
          <div
            ref={containerRef}
            className="crop-stage"
            style={{ position:"relative", userSelect:"none", touchAction:"none" }}
          >
            <img src={previewUrl} alt="Crop preview"
              style={{ display:"block", width:"100%", height:"auto", borderRadius:8 }} />

            <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:pct(box.y), background:"rgba(0,0,0,0.45)" }}/>
              <div style={{ position:"absolute", top:pct(box.y), left:0, width:pct(box.x), height:pct(box.h), background:"rgba(0,0,0,0.45)" }}/>
              <div style={{ position:"absolute", top:pct(box.y), left:pct(box.x+box.w), right:0, height:pct(box.h), background:"rgba(0,0,0,0.45)" }}/>
              <div style={{ position:"absolute", top:pct(box.y+box.h), left:0, right:0, bottom:0, background:"rgba(0,0,0,0.45)" }}/>
            </div>

            <div style={{
              position:"absolute",
              left:pct(box.x), top:pct(box.y),
              width:pct(box.w), height:pct(box.h),
              border:"2px solid #22c55e",
              boxSizing:"border-box", cursor:"move", zIndex:2,
            }} onPointerDown={e=>onPointerDown(e,"move")}>
              {[1/3,2/3].map(f=>(
                <React.Fragment key={f}>
                  <div style={{position:"absolute",top:0,bottom:0,left:`${f*100}%`,width:1,background:"rgba(255,255,255,0.3)"}}/>
                  <div style={{position:"absolute",left:0,right:0,top:`${f*100}%`,height:1,background:"rgba(255,255,255,0.3)"}}/>
                </React.Fragment>
              ))}
            </div>

            {[["nw",box.x,box.y,"nwse-resize"],["ne",box.x+box.w,box.y,"nesw-resize"],
              ["sw",box.x,box.y+box.h,"nesw-resize"],["se",box.x+box.w,box.y+box.h,"nwse-resize"]
            ].map(([t,lx,ly,cur])=>(
              <div key={t} style={{...handleStyle,left:pct(lx),top:pct(ly),cursor:cur}}
                onPointerDown={e=>onPointerDown(e,t)}/>
            ))}
            {[
              ["n", box.x+box.w/2, box.y, "ns-resize"],
              ["s", box.x+box.w/2, box.y+box.h, "ns-resize"],
              ["e", box.x+box.w,   box.y+box.h/2, "ew-resize"],
              ["w", box.x,         box.y+box.h/2, "ew-resize"],
            ].map(([t,lx,ly,cur])=>(
              <div key={t} style={{...handleStyle,left:pct(lx),top:pct(ly),cursor:cur,borderRadius:"50%"}}
                onPointerDown={e=>onPointerDown(e,t)}/>
            ))}
          </div>
        </div>
        <div className="modal-foot" style={{padding:"0 22px 22px"}}>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleCrop}
            style={{background:"#16a34a",borderColor:"#16a34a"}}>
            ✅ Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}

function countLifegroups(list) {
  return new Set(list.map(m => {
    const d = (m.ScheduleDay||"").trim();
    const t = (m.ScheduleTime||"").trim();
    return d||t ? `${d}|${t}` : `__nosch__${m.ID}`;
  })).size;
}

// ════════════════════════════════════════════════════════════════════
//  API HELPERS — with timeout so the button never gets stuck forever
// ════════════════════════════════════════════════════════════════════

// FIX: wrap every fetch in a 60-second AbortController timeout.
// Previously, if Google Apps Script's Drive.createFile() hung (e.g. slow
// network, Drive quota, or large photo), the fetch would wait indefinitely
// and the `saving` flag would never reset — leaving the button stuck.
function fetchWithTimeout(url, options, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function apiGet() {
  const res  = await fetchWithTimeout(SCRIPT_URL, { method:"GET" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load");
  return json.data;
}

async function apiPost(body) {
  // FIX: photo uploads go through the same endpoint but now have a timeout.
  // If the photo causes a timeout we throw a clear error that the catch
  // block in handleSaveMember will surface — resetting `saving` to false.
  const res  = await fetchWithTimeout(SCRIPT_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  }, 60000);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json;
}

function TrackList({ member }) {
  const done = TRACKS.filter(t => toBool(member[t.key]));
  if (done.length === 0) {
    return <span className="track-list-empty">No tracks yet</span>;
  }
  return (
    <div className="track-pills">
      {done.map(t => (
        <span key={t.key} className={`track-pill${t.key==="LGLEADER"?" track-pill-lgl":""}`}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function Avatar({ url, name, size = 38 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);
  if (!url || broken) {
    return (
      <div className="avatar avatar-fallback" style={{ width: size, height: size }}>
        <UserCircle2 size={Math.round(size * 0.68)} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      className="avatar" src={url} alt={name || "Member"}
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
    />
  );
}

function PhotoViewModal({ url, name, onClose }) {
  if (!url) return null;
  return (
    <div className="overlay photo-view-overlay" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="photo-view-inner">
        <button type="button" className="icon-btn photo-view-close" onClick={onClose} title="Close">
          <X size={18}/>
        </button>
        <img className="photo-view-img" src={url} alt={name || "Profile photo"} />
        {name && <span className="photo-view-name">{name}</span>}
      </div>
    </div>
  );
}

function MemberDetailModal({ member, allMembers, isTimothy, onClose, onEdit }) {
  if (!member) return null;
  const age = computeAge(member.Birthday);
  const [showPhoto, setShowPhoto] = useState(false);
  const hasEquipping = ["LIFECLASS","SOL1","SOL2","SOL3"].some(k => toBool(member[k]));

  return (
    <div className="overlay" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      {showPhoto && (
        <PhotoViewModal url={member.PhotoURL} name={member.Name} onClose={()=>setShowPhoto(false)}/>
      )}
      <div className="modal modal-sm member-detail-modal">
        <div className="modal-head">
          <h2>Member details</h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="md-top md-top-center">
            <span className="md-avatar-wrap">
              <span
                className="lc-avatar-clickable"
                role="button"
                tabIndex={0}
                title="View profile photo"
                onClick={()=>{ if (member.PhotoURL) setShowPhoto(true); }}
                onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); if (member.PhotoURL) setShowPhoto(true); } }}
              >
                <Avatar url={member.PhotoURL} name={member.Name} size={84}/>
              </span>
              {hasEquipping && member.EquippingBatch && (
                <span className="md-batch-badge">
                  <span className="md-batch-badge-label">Batch</span>
                  <span className="md-batch-badge-no">{member.EquippingBatch}</span>
                </span>
              )}
            </span>
            <span className="md-name">{member.Name}</span>
          </div>

          <div className="md-grid">
            <div className="md-field md-field-wide">
              <span className="md-label">Full name</span>
              <span className="md-value">{member.Name || "—"}</span>
            </div>
            <div className="md-field md-field-wide">
              <span className="md-label">Contact no.</span>
              <span className="md-value">{member.ContactNo || "—"}</span>
            </div>
            <div className="md-field md-field-wide">
              <span className="md-label">Address</span>
              <span className="md-value">{member.Address || "—"}</span>
            </div>
            <div className="md-field">
              <span className="md-label">Birthday</span>
              <span className="md-value">{member.Birthday ? formatBirthday(member.Birthday) : "—"}</span>
            </div>
            <div className="md-field">
              <span className="md-label">Age</span>
              <span className="md-value">{age!=null ? `${age} yrs old` : "—"}</span>
            </div>
            <div className="md-field md-field-wide">
              <span className="md-label">Status</span>
              <span className="md-value">{member.CivilStatus || "—"}</span>
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn-ghost" onClick={onClose}>Close</button>
            <button className="btn-primary" onClick={()=>{ onClose(); onEdit(member); }}>
              <Pencil size={14}/> Edit member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoPicker({ preview, onPickRaw, onRemove, uploading }) {
  const inputRef = useRef(null);
  return (
    <fieldset className="field">
      <span>Photo <span className="hint-inline">(optional)</span></span>
      <div className="photo-picker">
        <div className="photo-picker-preview">
          {uploading
            ? <Loader2 size={20} className="spin" />
            : preview
              ? <img src={preview} alt="Preview" />
              : <UserCircle2 size={26} strokeWidth={1.5} />}
        </div>
        <div className="photo-picker-actions">
          <button type="button" className="btn-ghost btn-photo"
            onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Camera size={14} />{preview ? "Change photo" : "Add photo"}
          </button>
          {preview && (
            <button type="button" className="btn-photo-remove" onClick={onRemove} disabled={uploading}>
              <X size={13} />Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef} type="file" accept="image/*" hidden
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onPickRaw(f);
            e.target.value = "";
          }}
        />
      </div>
    </fieldset>
  );
}

function Breadcrumb({ crumbs, current }) {
  return (
    <div className="bc">
      {crumbs.map((c,i) => (
        <React.Fragment key={i}>
          <button className="bc-btn" onClick={c.onClick}>{c.label}</button>
          <ChevronRight size={12}/>
        </React.Fragment>
      ))}
      <span className="bc-cur">{current}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={status==="Active"?"badge badge-green":"badge badge-red"}>
      <Circle size={6} style={{fill:"currentColor"}}/>{status}
    </span>
  );
}

function NotesBadge({ notes }) {
  if (!notes) return null;
  return (
    <span className="badge badge-notes">
      <FileText size={9}/>{notes}
    </span>
  );
}

function LGLeaderBadge() {
  return (
    <span className="badge badge-lgl">
      <Users size={9}/>LG Leader
    </span>
  );
}

function TimothyBadge() {
  return (
    <span className="badge badge-timothy">
      <UserCircle2 size={9}/>Timothy
    </span>
  );
}

function TimothyControl({ members, onPick }) {
  const picked = members.filter(m => toBool(m.TIMOTHY));
  if (picked.length === 0) {
    return (
      <button type="button" className="btn-pick-timothy" onClick={onPick}>
        <UserPlus size={12}/>Pick Timothy
      </button>
    );
  }
  return (
    <button type="button" className="timothy-chip" onClick={onPick} title="Click to change">
      <UserCircle2 size={12}/>Timothy: {picked.map(m=>m.Name).join(", ")}
    </button>
  );
}

function PickTimothyModal({ open, groupMembers, onCancel, onConfirm, saving }) {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open && groupMembers) {
      setSelected(groupMembers.filter(m => toBool(m.TIMOTHY)).map(m => m.ID));
    }
  }, [open, groupMembers]);

  if (!open || !groupMembers) return null;

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  return (
    <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget && !saving)onCancel();}}>
      <div className="modal modal-sm">
        <div className="modal-head">
          <h2>Pick Timothy</h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="hint">Choose who serves as Assistant/Timothy for this cell. You can pick more than one.</p>
          <div className="timothy-list">
            {groupMembers.map(m => {
              const on = selected.includes(m.ID);
              return (
                <label key={m.ID} className={on?"timothy-opt timothy-opt-on":"timothy-opt"}>
                  <input type="checkbox" checked={on} onChange={()=>toggle(m.ID)}/>
                  {m.Name}
                </label>
              );
            })}
          </div>
          <div className="modal-foot">
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn-primary" onClick={()=>onConfirm(selected)} disabled={saving}>
              {saving&&<Loader2 size={15} className="spin"/>}Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProceedToCloseCellModal({ open, member, membersUnder, onCancel, onConfirm, processing }) {
  if (!open || !member) return null;
  const openUnder = membersUnder.filter(m=>(m.Status||"Open Cell")==="Open Cell");
  return (
    <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="modal modal-sm">
        <div className="modal-head">
          <h2>Proceed to Close Cell?</h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="confirm-txt">
            <strong>{member.Name}</strong> will be seeded up from Open Cell to <strong>Close Cell</strong>.
          </p>
          {openUnder.length > 0 && (
            <div className="proceed-info">
              <p className="proceed-info-title">Their {openUnder.length} open cell member{openUnder.length!==1?"s":""} will carry over:</p>
              <div className="proceed-member-list">
                {openUnder.slice(0,8).map(m=>(
                  <span key={m.ID} className="proceed-member-chip">{m.Name}</span>
                ))}
                {openUnder.length>8&&<span className="proceed-member-chip proceed-more">+{openUnder.length-8} more</span>}
              </div>
              <p className="hint" style={{marginTop:6}}>Their ParentID stays the same — no re-entry needed.</p>
            </div>
          )}
          {openUnder.length === 0 && (
            <p className="hint">They have no open cell members yet. They will be moved to Close Cell.</p>
          )}
          <div className="modal-foot">
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn-seed" onClick={onConfirm} disabled={processing}>
              {processing?<Loader2 size={15} className="spin"/>:<ArrowUpRight size={14}/>}
              Seed Up to Close Cell
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  MEMBER MODAL
//  FIX: added `photoSaving` prop + two-phase button label so the user
//  sees "Uploading photo…" while the Drive upload is in progress, then
//  "Saving…" while the sheet row is being written.  This replaces the
//  single undifferentiated spinner that previously gave no feedback.
// ════════════════════════════════════════════════════════════════════
function MemberModal({ open, onClose, onSave, initial, leaderName, defaultStatus, saving, photoSaving, existingDays=[] }) {
  const blank = () => ({
    LifegroupLocation:"", ScheduleDay:"", ScheduleTime:"",
    Status: defaultStatus||"Open Cell", LifegroupStatus:"Active",
    Notes:"",
    Address:"", Birthday:"", CivilStatus:"", ContactNo:"",
    SUYNL:"FALSE", LIFECLASS:"FALSE", EquippingBatch:"",
    ENCOUNTER:"FALSE", WATERBAPTISM:"FALSE",
    SOL1:"FALSE", SOL2:"FALSE",
    REENCOUNTER:"FALSE", SOL3:"FALSE",
    LGLEADER:"FALSE",
  });

  const [form, setForm] = useState(blank());
  const [name, setName]   = useState("");
  const [names, setNames] = useState([""]);
  const [dayMode, setDayMode] = useState("pick");

  const [photoPreview, setPhotoPreview] = useState("");
  const [photoData, setPhotoData]       = useState("");
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [cropRaw, setCropRaw] = useState(null);

  async function handlePickRaw(file) {
    try {
      const raw = await fileToRaw(file);
      setCropRaw(raw);
    } catch {
      // ignore
    }
  }

  function handleCropConfirm(dataUrl) {
    setPhotoPreview(dataUrl);
    setPhotoData(dataUrl);
    setPhotoRemoved(false);
    setCropRaw(null);
  }

  function handleRemovePhoto() {
    setPhotoPreview("");
    setPhotoData("");
    setPhotoRemoved(true);
  }

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setPhotoPreview(initial.PhotoURL || "");
      setPhotoData("");
      setPhotoRemoved(false);
      setCropRaw(null);
      setForm({
        LifegroupLocation:initial.LifegroupLocation||"",
        ScheduleDay:      initial.ScheduleDay||"",
        ScheduleTime:     initial.ScheduleTime||"",
        Status:           initial.Status||defaultStatus||"Open Cell",
        LifegroupStatus:  initial.LifegroupStatus||"",
        Notes:            initial.Notes||"",
        Address:          initial.Address||"",
        Birthday:         initial.Birthday||"",
        CivilStatus:      initial.CivilStatus||"",
        ContactNo:        initial.ContactNo||"",
        SUYNL:            toBool(initial.SUYNL)        ?"TRUE":"FALSE",
        LIFECLASS:        toBool(initial.LIFECLASS)    ?"TRUE":"FALSE",
        EquippingBatch:   initial.EquippingBatch||"",
        ENCOUNTER:        toBool(initial.ENCOUNTER)    ?"TRUE":"FALSE",
        WATERBAPTISM:     toBool(initial.WATERBAPTISM) ?"TRUE":"FALSE",
        SOL1:             toBool(initial.SOL1)         ?"TRUE":"FALSE",
        SOL2:             toBool(initial.SOL2)         ?"TRUE":"FALSE",
        REENCOUNTER:      toBool(initial.REENCOUNTER)  ?"TRUE":"FALSE",
        SOL3:             toBool(initial.SOL3)         ?"TRUE":"FALSE",
        LGLEADER:         toBool(initial.LGLEADER)     ?"TRUE":"FALSE",
      });
      setName(initial.Name||"");
      setDayMode("type");
    } else {
      setForm(blank());
      setNames([""]);
      setPhotoPreview("");
      setPhotoData("");
      setPhotoRemoved(false);
      setCropRaw(null);
      setDayMode(existingDays.length ? "pick" : "type");
    }
  }, [open, initial, defaultStatus]);

  if (!open) return null;
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const dayOptions = [...new Set([...existingDays, ...DAYS])];

  const setNameAt = (i,v) => setNames(prev => prev.map((n,idx)=>idx===i?v:n));
  const addNameRow = () => setNames(prev => [...prev, ""]);
  const removeNameAt = (i) => setNames(prev => prev.filter((_,idx)=>idx!==i));

  const regularTracks = TRACKS.filter(t => t.key !== "LGLEADER");
  const lgLeaderTrack = TRACKS.find(t => t.key === "LGLEADER");

  // FIX: derive a meaningful button label from the two loading states
  const isBusy = saving || photoSaving;
  function submitLabel() {
    if (photoSaving) return "Uploading photo…";
    if (saving)      return "Saving…";
    if (initial)     return "Save changes";
    const n = names.map(x=>x.trim()).filter(Boolean).length;
    return n > 1 ? `Add ${n} members` : "Add member";
  }

  return (
    <>
      {cropRaw && (
        <CropModal
          imgEl={cropRaw.img}
          onCrop={handleCropConfirm}
          onCancel={() => setCropRaw(null)}
        />
      )}

      <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget && !cropRaw && !isBusy)onClose();}}>
        <div className="modal">
          <div className="modal-head">
            <h2>{initial?"Edit member":"Add member"}</h2>
            <button className="icon-btn" onClick={onClose} disabled={isBusy}><X size={18}/></button>
          </div>
          <form className="modal-body" onSubmit={e=>{
            e.preventDefault();
            const photoFields = photoData
              ? { PhotoData: photoData }
              : photoRemoved ? { PhotoURL: "" } : {};
            if (initial) {
              if (!name.trim()) return;
              onSave({ ...form, Name: name.trim(), Age: computeAge(form.Birthday) ?? "", ...photoFields });
            } else {
              const cleaned = names.map(n=>n.trim()).filter(Boolean);
              if (cleaned.length === 0) return;
              onSave({ ...form, Names: cleaned, Age: computeAge(form.Birthday) ?? "", ...photoFields });
            }
          }}>
            <p className="modal-sub">Under <strong>{leaderName}</strong></p>

            {(initial || names.length === 1) && (
              <PhotoPicker
                preview={photoPreview}
                onPickRaw={handlePickRaw}
                onRemove={handleRemovePhoto}
                uploading={photoSaving}
              />
            )}

            {initial ? (
              <label className="field">
                <span>Name</span>
                <input autoFocus type="text" value={name} required placeholder="Full name"
                  onChange={e=>setName(e.target.value)}/>
              </label>
            ) : (
              <fieldset className="field">
                <span>Name{names.length>1?"s":""}</span>
                <div className="name-rows">
                  {names.map((n,i)=>(
                    <div key={i} className="name-row">
                      <input autoFocus={i===0} type="text" value={n}
                        placeholder="Full name"
                        onChange={e=>setNameAt(i,e.target.value)}/>
                      {names.length>1 && (
                        <button type="button" className="icon-btn name-row-remove"
                          onClick={()=>removeNameAt(i)} title="Remove">
                          <X size={14}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-add-name" onClick={addNameRow}>
                  <Plus size={13}/> Add another name
                </button>
                <p className="hint">Everyone added here shares the same schedule, location, status, and tracks below.</p>
              </fieldset>
            )}

            {(initial || names.length === 1) && (
              <>
                <label className="field">
                  <span>Contact no. <span className="hint-inline">(optional)</span></span>
                  <input type="tel" value={form.ContactNo} placeholder="e.g. 0912 345 6789"
                    onChange={e=>set("ContactNo",e.target.value)}/>
                </label>

                <label className="field">
                  <span>Address <span className="hint-inline">(optional)</span></span>
                  <input type="text" value={form.Address} placeholder="House no., street, barangay, city"
                    onChange={e=>set("Address",e.target.value)}/>
                </label>

                <div className="field-row">
                  <label className="field">
                    <span>Birthday <span className="hint-inline">(optional)</span></span>
                    <input type="date" value={form.Birthday}
                      onChange={e=>set("Birthday",e.target.value)}
                      style={{fontFamily:"inherit"}}/>
                  </label>
                  <label className="field">
                    <span>Age</span>
                    <input type="text" value={computeAge(form.Birthday) ?? ""} readOnly
                      placeholder="Auto from birthday" className="field-readonly"/>
                  </label>
                </div>

                <fieldset className="field">
                  <span>Status</span>
                  <div className="seg-group">
                    {["Single","Married","Widowed"].map(s=>(
                      <button key={s} type="button"
                        className={form.CivilStatus===s?"seg seg-on":"seg"}
                        onClick={()=>set("CivilStatus",s)}>{s}</button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <fieldset className="field">
              <span>Schedule day</span>
              <div className="day-toggle">
                <button type="button" className={dayMode==="pick"?"dtog dtog-on":"dtog"}
                  onClick={()=>setDayMode("pick")}>Pick a day</button>
                <button type="button" className={dayMode==="type"?"dtog dtog-on":"dtog"}
                  onClick={()=>setDayMode("type")}>Type freely</button>
              </div>
              {dayMode==="pick" ? (
                <div className="day-grid">
                  {dayOptions.map(d=>(
                    <button key={d} type="button"
                      className={form.ScheduleDay===d?"day-chip day-chip-on":"day-chip"}
                      onClick={()=>set("ScheduleDay",d)}>{d}</button>
                  ))}
                </div>
              ) : (
                <input type="text" value={form.ScheduleDay} placeholder="e.g. Saturday"
                  onChange={e=>set("ScheduleDay",e.target.value)}/>
              )}
            </fieldset>

            <label className="field">
              <span>Schedule time <span className="hint-inline">(optional)</span></span>
              <input type="time" value={form.ScheduleTime}
                onChange={e=>set("ScheduleTime",e.target.value)}
                style={{fontFamily:"inherit"}}/>
              <p className="hint">Add a time if you have multiple lifegroups on the same day.</p>
            </label>

            <label className="field">
              <span>Lifegroup location</span>
              <input type="text" value={form.LifegroupLocation} placeholder="Where this cell meets"
                onChange={e=>set("LifegroupLocation",e.target.value)}/>
            </label>

            <fieldset className="field">
              <span>Cell status</span>
              <div className="seg-group">
                {["Open Cell","Close Cell"].map(s=>(
                  <button key={s} type="button"
                    className={form.Status===s?"seg seg-on":"seg"}
                    onClick={()=>set("Status",s)}>{s}</button>
                ))}
              </div>
              <p className="hint">{form.Status==="Open Cell"
                ?"Still under discipleship — no lifegroup yet."
                :"Now leading their own lifegroup."}</p>
            </fieldset>

            <fieldset className="field">
              <span>Lifegroup status</span>
              <div className="seg-group">
                <button type="button"
                  className={form.LifegroupStatus==="Active"?"seg seg-green":"seg"}
                  onClick={()=>set("LifegroupStatus","Active")}>Active</button>
                <button type="button"
                  className={form.LifegroupStatus==="Inactive"?"seg seg-red":"seg"}
                  onClick={()=>set("LifegroupStatus","Inactive")}>Inactive</button>
              </div>
            </fieldset>

            <fieldset className="field">
              <span>Track progress</span>
              <div className="track-row">
                {regularTracks.map(t=>{
                  const on=form[t.key]==="TRUE";
                  const EQUIPPING_KEYS = ["LIFECLASS","SOL1","SOL2","SOL3"];
                  return (
                    <label key={t.key} className={on?"chip chip-on":"chip"}>
                      <input type="checkbox" checked={on}
                        onChange={e=>{
                          const checked = e.target.checked;
                          set(t.key,checked?"TRUE":"FALSE");
                          if (EQUIPPING_KEYS.includes(t.key) && !checked) {
                            const stillAnyOn = EQUIPPING_KEYS
                              .filter(k=>k!==t.key)
                              .some(k=>form[k]==="TRUE");
                            if (!stillAnyOn) set("EquippingBatch","");
                          }
                        }}/>
                      {t.label}
                    </label>
                  );
                })}
              </div>
              {["LIFECLASS","SOL1","SOL2","SOL3"].some(k=>form[k]==="TRUE") && (
                <label className="field lifeclass-batch-field">
                  <span>Equipping batch</span>
                  <input type="text" value={form.EquippingBatch}
                    placeholder="e.g. Batch 5"
                    onChange={e=>set("EquippingBatch",e.target.value)}/>
                  <p className="hint">Which batch is this member going through — Life Class → SOL 1 → SOL 2 → SOL 3?</p>
                </label>
              )}
              <div className="lgl-track-section">
                <div className="lgl-track-divider">
                  <span>Leadership Track</span>
                </div>
                {(() => {
                  const t = lgLeaderTrack;
                  const on = form[t.key] === "TRUE";
                  return (
                    <label className={on?"chip chip-on chip-lgl":"chip chip-lgl"}>
                      <input type="checkbox" checked={on}
                        onChange={e=>set(t.key,e.target.checked?"TRUE":"FALSE")}/>
                      <Users size={13}/> {t.label}
                    </label>
                  );
                })()}
                <p className="hint">Check if this member handles their own lifegroup even while still in Open Cell.</p>
              </div>
            </fieldset>

            <label className="field">
              <span>Notes <span className="hint-inline">(optional)</span></span>
              <input type="text" value={form.Notes}
                placeholder="e.g. re-visit, follow-up, inconsistent…"
                onChange={e=>set("Notes",e.target.value)}/>
              <p className="hint">Shows in the Cell Leader column of the report.</p>
            </label>

            <div className="modal-foot">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={isBusy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isBusy}>
                {isBusy && <Loader2 size={15} className="spin"/>}
                {submitLabel()}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  LEADER MODAL — with crop UI wired up
// ════════════════════════════════════════════════════════════════════
function LeaderModal({ open, onClose, onSave, gender, saving, photoSaving, initial }) {
  const [name, setName] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoData, setPhotoData]       = useState("");
  const [cropRaw, setCropRaw]           = useState(null);
  const isEdit = !!initial;

  useEffect(()=>{
    if (open) {
      setName(initial?.Name || "");
      setPhotoPreview(initial?.PhotoURL || "");
      setPhotoData("");
      setCropRaw(null);
    }
  },[open, initial]);

  async function handlePickRaw(file) {
    try {
      const raw = await fileToRaw(file);
      setCropRaw(raw);
    } catch {
      // ignore
    }
  }

  function handleCropConfirm(dataUrl) {
    setPhotoPreview(dataUrl);
    setPhotoData(dataUrl);
    setCropRaw(null);
  }

  function handleRemovePhoto() { setPhotoPreview(""); setPhotoData(""); }

  if (!open) return null;

  const isBusy = saving || photoSaving;
  const btnLabel = photoSaving ? "Uploading photo…" : saving ? "Saving…" : (isEdit ? "Save changes" : "Add leader");
  const leaderGender = gender || initial?.Gender;

  return (
    <>
      {cropRaw && (
        <CropModal
          imgEl={cropRaw.img}
          onCrop={handleCropConfirm}
          onCancel={() => setCropRaw(null)}
        />
      )}

      <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget && !cropRaw && !isBusy)onClose();}}>
        <div className="modal modal-sm">
          <div className="modal-head">
            <h2>{isEdit ? "Edit leader profile" : "Add lifegroup leader"}</h2>
            <button className="icon-btn" onClick={onClose} disabled={isBusy}><X size={18}/></button>
          </div>
          <form className="modal-body" onSubmit={e=>{
            e.preventDefault(); if(!name.trim()) return;
            const member = { Name:name.trim(), Gender:leaderGender };
            if (photoData) member.PhotoData = photoData;
            // If editing and the existing photo was removed (not replaced),
            // explicitly clear PhotoURL — otherwise the backend leaves the
            // old photo untouched since updateMember only writes fields
            // present on the submitted object.
            if (isEdit && !photoData && !photoPreview && initial?.PhotoURL) {
              member.PhotoURL = "";
            }
            onSave(member);
          }}>
            <label className="field">
              <span>Leader name</span>
              <input autoFocus type="text" value={name} required placeholder="Full name"
                onChange={e=>setName(e.target.value)}/>
            </label>
            <PhotoPicker
              preview={photoPreview}
              onPickRaw={handlePickRaw}
              onRemove={handleRemovePhoto}
              uploading={photoSaving}
            />
            {!isEdit && <p className="hint">Added under {NETWORK_LEADERS[leaderGender] || leaderGender}.</p>}
            <div className="modal-foot">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={isBusy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isBusy}>
                {isBusy && <Loader2 size={15} className="spin"/>}
                {btnLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function ConfirmDelete({ open, name, onCancel, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="modal modal-sm">
        <div className="modal-head">
          <h2>Remove member?</h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="confirm-txt">This removes <strong>{name}</strong> from the sheet. This can't be undone.</p>
          <div className="modal-foot">
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn-danger" onClick={onConfirm} disabled={deleting}>
              {deleting?<Loader2 size={15} className="spin"/>:<Trash2 size={14}/>}Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2,"0")} ${ampm}`;
}

function computeAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

function formatBirthday(birthday) {
  if (!birthday) return "";
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return birthday;
  return b.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

function MemberRow({ member, allMembers, onEdit, onDelete, onViewCell, onProceedToClose, rank, isTimothy }) {
  const [showPhoto, setShowPhoto] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isClose = member.Status === "Close Cell";
  const hasLGL = isLGLeader(member);
  const hasTimothy = isTimothy;
  const ownOpenMembers = allMembers.filter(m =>
    String(m.ParentID) === String(member.ID) && (m.Status||"Open Cell") === "Open Cell"
  );

  return (
    <div className={`member-row${isClose?" member-row-close":""}${hasLGL?" member-row-lgl":""}`}>
      {showPhoto && (
        <PhotoViewModal url={member.PhotoURL} name={member.Name} onClose={()=>setShowPhoto(false)}/>
      )}
      {showDetails && (
        <MemberDetailModal member={member} allMembers={allMembers} isTimothy={isTimothy}
          onClose={()=>setShowDetails(false)} onEdit={onEdit}/>
      )}
      <div className="member-rank">{rank}</div>
      <span
        className="lc-avatar-clickable"
        role="button"
        tabIndex={0}
        title="View profile photo"
        onClick={()=>{ if (member.PhotoURL) setShowPhoto(true); }}
        onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); if (member.PhotoURL) setShowPhoto(true); } }}
      >
        <Avatar url={member.PhotoURL} name={member.Name} size={54}/>
      </span>
      <div className="member-main">
        <div className="member-name-line">
          <span className="member-name">{member.Name}</span>
          {isClose && <span className="badge badge-close">Close Cell</span>}
          {hasLGL && <LGLeaderBadge/>}
          {hasTimothy && <TimothyBadge/>}
          <StatusBadge status={member.LifegroupStatus}/>
          {member.Notes && <NotesBadge notes={member.Notes}/>}
          {member.LifegroupLocation && (
            <span className="member-loc"><MapPin size={11}/>{member.LifegroupLocation}</span>
          )}
        </div>
        <TrackList member={member}/>
        {hasLGL && !isClose && (
          <div className="lgl-action-row">
            <button className="btn-view-cell" onClick={()=>onViewCell(member)}>
              <Users size={12}/>
              View Cell ({ownOpenMembers.length} member{ownOpenMembers.length!==1?"s":""})
              <ChevronRight size={12}/>
            </button>
            <button className="btn-proceed-close" onClick={()=>onProceedToClose(member)}>
              <ArrowUpRight size={12}/>
              Proceed to Close Cell
            </button>
          </div>
        )}
      </div>
      <div className="member-side">
        <button className="icon-btn" title="View details" onClick={()=>setShowDetails(true)}><Eye size={14}/></button>
        <button className="icon-btn" onClick={()=>onEdit(member)}><Pencil size={14}/></button>
        <button className="icon-btn icon-btn-danger" onClick={()=>onDelete(member)}><Trash2 size={14}/></button>
      </div>
    </div>
  );
}

function GroupedMembers({ members, allMembers, onEdit, onDelete, onViewCell, onProceedToClose, onPickTimothy }) {
  const groups = {};
  members.forEach(m => {
    const day  = (m.ScheduleDay||"").trim()  || "";
    const time = (m.ScheduleTime||"").trim() || "";
    const key  = day || time ? `${day}||${time}` : "||";
    if (!groups[key]) groups[key] = { day, time, members: [] };
    groups[key].members.push(m);
  });

  Object.values(groups).forEach(g => {
    g.members.sort((a, b) => trackCount(b) - trackCount(a));
  });

  const sorted = Object.keys(groups).sort((a, b) => {
    const ga = groups[a], gb = groups[b];
    if (!ga.day && !ga.time) return 1;
    if (!gb.day && !gb.time) return -1;
    const ai = DAYS.indexOf(ga.day), bi = DAYS.indexOf(gb.day);
    if (ai !== bi) {
      if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi;
    }
    return (ga.time||"").localeCompare(gb.time||"");
  });

  return (
    <div className="groups">
      {sorted.map(key => {
        const { day, time, members: list } = groups[key];
        const hasSchedule = day || time;
        const soloIsTimothy = list.length === 1;
        return (
          <div key={key} className="day-group">
            <div className="day-group-head">
              <span className="day-group-label">
                {hasSchedule ? (
                  <>
                    {day && <><Calendar size={13}/>{day}</>}
                    {time && <><Clock size={13} style={{marginLeft: day ? 6 : 0}}/>{formatTime(time)}</>}
                  </>
                ) : (
                  <span style={{color:"var(--faint)"}}>No schedule</span>
                )}
              </span>
              <div className="day-group-right">
                {onPickTimothy && list.length > 1 && (
                  <TimothyControl members={list} onPick={()=>onPickTimothy(list)}/>
                )}
                <span className="day-group-count">{list.length} {list.length===1?"member":"members"}</span>
              </div>
            </div>
            <div className="member-list">
              {list.map((m, i) => (
                <MemberRow key={m.ID} member={m} allMembers={allMembers} rank={i+1}
                  isTimothy={soloIsTimothy ? true : toBool(m.TIMOTHY)}
                  onEdit={onEdit} onDelete={onDelete}
                  onViewCell={onViewCell} onProceedToClose={onProceedToClose}/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function lgLabel(n) { return `${n} lifegroup${n !== 1 ? "s" : ""}`; }

function HomeScreen({ members, leaders, loading, error, onRetry, onEnter }) {
  const allNonRoot = members.filter(m => m.ParentID);
  const closed = allNonRoot.filter(m=>m.Status==="Close Cell").length;
  const boysLeaders  = leaders.filter(l=>l.Gender==="Boys").length;
  const girlsLeaders = leaders.filter(l=>l.Gender==="Girls").length;
  return (
    <div className="home-wrap">
      <div className="home-hero">
        <span className="eyebrow">Sonny Claudio's Cell Report</span>
        <h1>Every disciple,<br/>walking the path.</h1>
        <p className="lede">Track every lifegroup leader's disciples — who's still under their wing,
          and who's already leading a lifegroup of their own.</p>
      </div>
      {error && (
        <div className="error-box">
          <AlertCircle size={15}/>{error}
          <button className="link-btn" onClick={onRetry}>Try again</button>
        </div>
      )}
      <div className="stats">
        {[
          {n: allNonRoot.length, l:"Total disciples"},
          {n: leaders.length,    l:"CLOSE CELL"},
          {n: closed,            l:"LIFEGROUP LEADERS"},
        ].map(s=>(
          <div key={s.l} className="stat">
            <span className="stat-n">{loading?"—":s.n}</span>
            <span className="stat-l">{s.l}</span>
          </div>
        ))}
      </div>
      <div className="doors">
        {[
          {g:"Boys", Icon:UserCircle2, networkLeader:NETWORK_LEADERS.Boys, count:boysLeaders, cls:"door-boys"},
          {g:"Girls",Icon:Users,       networkLeader:NETWORK_LEADERS.Girls,count:girlsLeaders,cls:"door-girls"},
        ].map(({g,Icon,networkLeader,count,cls})=>(
          <button key={g} className={`door ${cls}`} onClick={()=>onEnter(g)}>
            <Icon size={34} strokeWidth={1.6}/>
            <span className="door-network-label">Network Leader</span>
            <span className="door-title">{networkLeader}</span>
            <span className="door-count">{loading?"…":`${count} lifegroup leader${count!==1?"s":""}`}</span>
            <span className="door-go">Open <ChevronRight size={14}/></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GenderScreen({ gender, leaders, members, loading, goHome, onPickLeader, onAddLeader, onEditLeader }) {
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const list = leaders
    .filter(l=>l.Gender===gender)
    .sort((a,b)=>{
      const ca = members.filter(m=>String(m.ParentID)===String(a.ID)&&m.Status==="Close Cell").length;
      const cb = members.filter(m=>String(m.ParentID)===String(b.ID)&&m.Status==="Close Cell").length;
      return cb - ca;
    });
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const networkLeader = NETWORK_LEADERS[gender] || gender;
  return (
    <div className={`screen ${acc}`}>
      <PhotoViewModal url={viewingPhoto?.url} name={viewingPhoto?.name} onClose={()=>setViewingPhoto(null)}/>
      <Breadcrumb crumbs={[{label:"Home",onClick:goHome}]} current={gender}/>
      <div className="screen-head">
        <div>
          <span className="eyebrow-sm">Network Leader · {networkLeader}</span>
          <h1>{gender}</h1>
          <p className="sub">{list.length} lifegroup {list.length===1?"leader":"leaders"}</p>
        </div>
        <button className="btn-primary" onClick={onAddLeader}><UserPlus size={15}/>Add leader</button>
      </div>
      {loading ? <div className="empty"><Loader2 size={22} className="spin"/></div>
      : list.length===0 ? (
        <div className="empty">
          <p className="empty-title">No leaders yet</p>
          <p className="empty-sub">Add the first {gender.toLowerCase()} lifegroup leader.</p>
          <button className="btn-primary" onClick={onAddLeader}><Plus size={15}/>Add leader</button>
        </div>
      ) : (
        <div className="card-grid">
          {list.map(l=>{
            const mine       = members.filter(m=>String(m.ParentID)===String(l.ID));
            const openList   = mine.filter(m=>(m.Status||"Open Cell")==="Open Cell");
            const closeList  = mine.filter(m=>m.Status==="Close Cell");
            const openLG     = countLifegroups(openList);
            const closeLG    = countLifegroups(closeList);
            const schedules  = [...new Map(mine.map(m=>{
              const d=(m.ScheduleDay||"").trim(), t=(m.ScheduleTime||"").trim();
              return [`${d}|${t}`,{day:d,time:t}];
            })).values()].filter(s=>s.day||s.time);
            return (
              <div key={l.ID} className="leader-card-wrap" style={{ position:"relative" }}>
                <button
                  type="button"
                  className="icon-btn lc-edit-btn"
                  title="Edit profile photo"
                  onClick={e=>{ e.stopPropagation(); onEditLeader(l); }}
                  style={{ position:"absolute", top:8, right:8, zIndex:2,
                    background:"rgba(255,255,255,0.92)", borderRadius:"50%",
                    boxShadow:"0 1px 3px rgba(0,0,0,0.15)" }}
                >
                  <Pencil size={13}/>
                </button>
                <button className="leader-card" onClick={()=>onPickLeader(l)}>
                <div className="lc-avatar-row">
                  <span
                    className="lc-avatar-clickable"
                    role="button"
                    tabIndex={0}
                    title="View profile photo"
                    onClick={e=>{ e.stopPropagation(); if (l.PhotoURL) setViewingPhoto({ url: l.PhotoURL, name: l.Name }); }}
                    onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.stopPropagation(); e.preventDefault(); if (l.PhotoURL) setViewingPhoto({ url: l.PhotoURL, name: l.Name }); } }}
                  >
                    <Avatar url={l.PhotoURL} name={l.Name} size={44}/>
                  </span>
                  <span className="lc-tag">Lifegroup Leader</span>
                </div>
                <span className="lc-name">{l.Name}</span>
                <div className="lc-counts">
                  <span className="lc-pill lc-open">{openLG} Open Cell</span>
                  <span className="lc-pill lc-close">{closeLG} Close Cell</span>
                </div>
                {schedules.length>0 && (
                  <div className="lc-days">
                    {schedules.slice(0,3).map((s,i)=>(
                      <span key={i} className="day-badge">
                        {s.day && <><Calendar size={10}/>{s.day}</>}
                        {s.time && <><Clock size={10} style={{marginLeft:s.day?3:0}}/>{formatTime(s.time)}</>}
                      </span>
                    ))}
                    {schedules.length>3 && <span className="day-badge">+{schedules.length-3}</span>}
                  </div>
                )}
                <span className="go-lnk">View <ChevronRight size={13}/></span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeaderScreen({ gender, leader, members, goHome, goGender, onPickCell, onEditLeader }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const mine = members.filter(m=>String(m.ParentID)===String(leader.ID));
  const open  = mine.filter(m=>(m.Status||"Open Cell")==="Open Cell");
  const close = mine.filter(m=>m.Status==="Close Cell");
  const networkLeader = NETWORK_LEADERS[gender]||gender;
  const getSchedules = list => [...new Map(list.map(m=>{
    const d=(m.ScheduleDay||"").trim(), t=(m.ScheduleTime||"").trim();
    return [`${d}|${t}`,{day:d,time:t}];
  })).values()].filter(s=>s.day||s.time);
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[{label:"Home",onClick:goHome},{label:gender,onClick:goGender}]} current={leader.Name}/>
      <div className="screen-head">
        <div className="screen-head-leader">
          <Avatar url={leader.PhotoURL} name={leader.Name} size={54}/>
          <div>
            <span className="eyebrow-sm">Lifegroup Leader · under {networkLeader}</span>
            <h1>{leader.Name}</h1>
            <p className="sub">{mine.length} {mine.length===1?"disciple":"disciples"} total</p>
          </div>
          {onEditLeader && (
            <button
              type="button"
              className="icon-btn"
              title="Edit my profile photo"
              onClick={()=>onEditLeader(leader)}
              style={{ marginLeft:"auto" }}
            >
              <Pencil size={16}/>
            </button>
          )}
        </div>
      </div>
      <div className="cell-split">
        <button className="cell-card cell-open" onClick={()=>onPickCell("Open Cell")}>
          <div className="cc-top"><span className="cc-count">{countLifegroups(open)}</span><span className="cc-label">Open Cell</span></div>
          {getSchedules(open).length>0&&<div className="cc-days">{getSchedules(open).map((s,i)=><span key={i} className="day-badge">{s.day&&<><Calendar size={10}/>{s.day}</>}{s.time&&<><Clock size={10} style={{marginLeft:s.day?3:0}}/>{formatTime(s.time)}</>}</span>)}</div>}
          <p className="cc-desc">Members still under {leader.Name}'s discipleship.</p>
          <span className="go-lnk">View members <ChevronRight size={13}/></span>
        </button>
        <button className="cell-card cell-close" onClick={()=>onPickCell("Close Cell")}>
          <div className="cc-top"><span className="cc-count">{countLifegroups(close)}</span><span className="cc-label">Close Cell</span></div>
          {getSchedules(close).length>0&&<div className="cc-days">{getSchedules(close).map((s,i)=><span key={i} className="day-badge">{s.day&&<><Calendar size={10}/>{s.day}</>}{s.time&&<><Clock size={10} style={{marginLeft:s.day?3:0}}/>{formatTime(s.time)}</>}</span>)}</div>}
          <p className="cc-desc">Disciples who now lead their own lifegroup.</p>
          <span className="go-lnk">View leaders <ChevronRight size={13}/></span>
        </button>
      </div>
    </div>
  );
}

function OpenCellScreen({ gender, leader, members, loading, goHome, goGender, goLeader, onAdd, onEdit, onDelete, onViewLGLeaderCell, onProceedToClose, onPickTimothy }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const list = members.filter(m=>String(m.ParentID)===String(leader.ID)&&(m.Status||"Open Cell")==="Open Cell");
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},{label:leader.Name,onClick:goLeader},
      ]} current="Open Cell"/>
      <div className="screen-head">
        <div>
          <span className="eyebrow-sm">Open Cell · {leader.Name}</span>
          <h1>Members</h1>
          <p className="sub">Sorted by track progress — most advanced first.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add member</button>
      </div>
      {loading ? <div className="empty"><Loader2 size={22} className="spin"/></div>
      : list.length===0 ? (
        <div className="empty">
          <p className="empty-title">No open cell members yet</p>
          <p className="empty-sub">Add a member under {leader.Name} to start tracking.</p>
          <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add member</button>
        </div>
      ) : (
        <GroupedMembers members={list} allMembers={members} onEdit={onEdit} onDelete={onDelete}
          onViewCell={onViewLGLeaderCell} onProceedToClose={onProceedToClose} onPickTimothy={onPickTimothy}/>
      )}
    </div>
  );
}

function LGLeaderCellScreen({ gender, leader, lglMember, members, loading, goHome, goGender, goLeader, goOpenCell, onAdd, onEdit, onDelete, onPickTimothy }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const list = members.filter(m=>String(m.ParentID)===String(lglMember.ID)&&(m.Status||"Open Cell")==="Open Cell");

  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},
        {label:leader.Name,onClick:goLeader},{label:"Open Cell",onClick:goOpenCell},
      ]} current={`${lglMember.Name}'s Cell`}/>
      <div className="screen-head">
        <div className="screen-head-leader">
          <Avatar url={lglMember.PhotoURL} name={lglMember.Name} size={54}/>
          <div>
            <span className="eyebrow-sm">LG Leader Cell · under {leader.Name}</span>
            <h1>{lglMember.Name}'s Cell</h1>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
              <LGLeaderBadge/>
              <StatusBadge status={lglMember.LifegroupStatus}/>
              {lglMember.LifegroupLocation&&(
                <span className="sub" style={{display:"flex",alignItems:"center",gap:4}}>
                  <MapPin size={12}/>{lglMember.LifegroupLocation}
                </span>
              )}
            </div>
            <p className="sub" style={{marginTop:6}}>{list.length} open cell {list.length===1?"member":"members"}</p>
          </div>
        </div>
      </div>
      <div className="lgl-notice">
        <Users size={14}/>
        <span>This member handles their own lifegroup while still in Open Cell. Only their Open Cell members are shown here — Close Cell members will appear after seeding up.</span>
      </div>
      {loading ? <div className="empty"><Loader2 size={22} className="spin"/></div>
      : list.length===0 ? (
        <div className="empty">
          <p className="empty-title">No cell members yet</p>
          <p className="empty-sub">Add members under {lglMember.Name}.</p>
          <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add member</button>
        </div>
      ) : (
        <GroupedMembers members={list} allMembers={members} onEdit={onEdit} onDelete={onDelete}
          onViewCell={()=>{}} onProceedToClose={()=>{}} onPickTimothy={onPickTimothy}/>
      )}
    </div>
  );
}

function CloseCellScreen({ gender, leader, members, loading, goHome, goGender, goLeader, onAdd, onEdit, onDelete, onPickSubLeader }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";

  const list = members
    .filter(m=>String(m.ParentID)===String(leader.ID)&&m.Status==="Close Cell")
    .sort((a,b)=>{
      const ca = members.filter(x=>String(x.ParentID)===String(a.ID)).length;
      const cb = members.filter(x=>String(x.ParentID)===String(b.ID)).length;
      return cb - ca;
    });

  const groups={};
  list.forEach(m=>{
    const day=(m.ScheduleDay||"").trim(), time=(m.ScheduleTime||"").trim();
    const key=day||time?`${day}||${time}`:"||";
    if(!groups[key]) groups[key]={day,time,members:[]};
    groups[key].members.push(m);
  });
  const sorted=Object.keys(groups).sort((a,b)=>{
    const ga=groups[a],gb=groups[b];
    if(!ga.day&&!ga.time) return 1; if(!gb.day&&!gb.time) return -1;
    const ai=DAYS.indexOf(ga.day),bi=DAYS.indexOf(gb.day);
    if(ai!==bi){if(ai===-1) return 1; if(bi===-1) return -1; return ai-bi;}
    return (ga.time||"").localeCompare(gb.time||"");
  });
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},{label:leader.Name,onClick:goLeader},
      ]} current="Close Cell"/>
      <div className="screen-head">
        <div>
          <span className="eyebrow-sm">Close Cell · {leader.Name}</span>
          <h1>Leaders</h1>
          <p className="sub">Disciples who now lead their own lifegroup.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add leader</button>
      </div>
      {loading ? <div className="empty"><Loader2 size={22} className="spin"/></div>
      : list.length===0 ? (
        <div className="empty">
          <p className="empty-title">No close cell leaders yet</p>
          <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add leader</button>
        </div>
      ) : (
        <div className="groups">
          {sorted.map(key=>{
            const{day,time,members:grpMembers}=groups[key];
            const hasSchedule=day||time;
            return(
              <div key={key} className="day-group">
                <div className="day-group-head">
                  <span className="day-group-label">{hasSchedule?(<>{day&&<><Calendar size={13}/>{day}</>}{time&&<><Clock size={13} style={{marginLeft:day?6:0}}/>{formatTime(time)}</>}</>):<span style={{color:"var(--faint)"}}>No schedule</span>}</span>
                  <span className="day-group-count">{grpMembers.length} {grpMembers.length===1?"leader":"leaders"}</span>
                </div>
                <div className="subldr-list">
                  {grpMembers.map(m=>{
                    const ownMembers=members.filter(x=>String(x.ParentID)===String(m.ID));
                    const ownLG=countLifegroups(ownMembers);
                    return(
                      <div key={m.ID} className="subldr-row">
                        <button className="subldr-main" onClick={()=>onPickSubLeader(m)}>
                          <Avatar url={m.PhotoURL} name={m.Name} size={34}/>
                          <div className="subldr-info">
                            <span className="subldr-name">{m.Name}</span>
                            {m.LifegroupLocation&&<span className="subldr-loc"><MapPin size={11}/>{m.LifegroupLocation}</span>}
                          </div>
                          <div className="subldr-meta">
                            <StatusBadge status={m.LifegroupStatus}/>
                            {m.Notes&&<NotesBadge notes={m.Notes}/>}
                            <span className="subldr-count">{lgLabel(ownLG)}</span>
                            <ChevronRight size={15} style={{color:"var(--faint)"}}/>
                          </div>
                        </button>
                        <div className="subldr-actions">
                          <TrackList member={m}/>
                          <button className="icon-btn" onClick={()=>onEdit(m)}><Pencil size={14}/></button>
                          <button className="icon-btn icon-btn-danger" onClick={()=>onDelete(m)}><Trash2 size={14}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubLeaderScreen({ gender, leader, subLeader, members, goHome, goGender, goLeader, goCloseCell, onPickCell }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const mine = members.filter(m=>String(m.ParentID)===String(subLeader.ID));
  const open  = mine.filter(m=>(m.Status||"Open Cell")==="Open Cell");
  const close = mine.filter(m=>m.Status==="Close Cell");
  const getSchedules = list => [...new Map(list.map(m=>{
    const d=(m.ScheduleDay||"").trim(),t=(m.ScheduleTime||"").trim();
    return [`${d}|${t}`,{day:d,time:t}];
  })).values()].filter(s=>s.day||s.time);
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},
        {label:leader.Name,onClick:goLeader},{label:"Close Cell",onClick:goCloseCell},
      ]} current={subLeader.Name}/>
      <div className="screen-head">
        <div className="screen-head-leader">
          <Avatar url={subLeader.PhotoURL} name={subLeader.Name} size={54}/>
          <div>
            <span className="eyebrow-sm">Close Cell Leader · under {leader.Name}</span>
            <h1>{subLeader.Name}</h1>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
              <StatusBadge status={subLeader.LifegroupStatus}/>
              {subLeader.Notes&&<NotesBadge notes={subLeader.Notes}/>}
              {subLeader.LifegroupLocation&&(
                <span className="sub" style={{display:"flex",alignItems:"center",gap:4}}>
                  <MapPin size={12}/>{subLeader.LifegroupLocation}
                </span>
              )}
            </div>
            <p className="sub" style={{marginTop:6}}>{mine.length} {mine.length===1?"disciple":"disciples"} total</p>
          </div>
        </div>
      </div>
      <div className="cell-split">
        <button className="cell-card cell-open" onClick={()=>onPickCell("Open Cell")}>
          <div className="cc-top"><span className="cc-count">{countLifegroups(open)}</span><span className="cc-label">Open Cell</span></div>
          {getSchedules(open).length>0&&<div className="cc-days">{getSchedules(open).map((s,i)=><span key={i} className="day-badge">{s.day&&<><Calendar size={10}/>{s.day}</>}{s.time&&<><Clock size={10} style={{marginLeft:s.day?3:0}}/>{formatTime(s.time)}</>}</span>)}</div>}
          <p className="cc-desc">Members still under {subLeader.Name}'s discipleship.</p>
          <span className="go-lnk">View members <ChevronRight size={13}/></span>
        </button>
        <button className="cell-card cell-close" onClick={()=>onPickCell("Close Cell")}>
          <div className="cc-top"><span className="cc-count">{countLifegroups(close)}</span><span className="cc-label">Close Cell</span></div>
          {getSchedules(close).length>0&&<div className="cc-days">{getSchedules(close).map((s,i)=><span key={i} className="day-badge">{s.day&&<><Calendar size={10}/>{s.day}</>}{s.time&&<><Clock size={10} style={{marginLeft:s.day?3:0}}/>{formatTime(s.time)}</>}</span>)}</div>}
          <p className="cc-desc">Disciples who now lead their own lifegroup.</p>
          <span className="go-lnk">View leaders <ChevronRight size={13}/></span>
        </button>
      </div>
    </div>
  );
}

function SubLeaderOpenScreen({ gender, leader, subLeader, members, loading, goHome, goGender, goLeader, goCloseCell, goSubLeader, onAdd, onEdit, onDelete, onViewLGLeaderCell, onProceedToClose, onPickTimothy }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";
  const list = members.filter(m=>String(m.ParentID)===String(subLeader.ID)&&(m.Status||"Open Cell")==="Open Cell");
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},
        {label:leader.Name,onClick:goLeader},{label:"Close Cell",onClick:goCloseCell},{label:subLeader.Name,onClick:goSubLeader},
      ]} current="Open Cell"/>
      <div className="screen-head">
        <div>
          <span className="eyebrow-sm">Open Cell · {subLeader.Name}</span>
          <h1>Members</h1>
          <p className="sub">Sorted by track progress — most advanced first.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add member</button>
      </div>
      {loading?<div className="empty"><Loader2 size={22} className="spin"/></div>
      :list.length===0?(<div className="empty"><p className="empty-title">No open cell members yet</p><p className="empty-sub">Add a member under {subLeader.Name}.</p><button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add member</button></div>)
      :<GroupedMembers members={list} allMembers={members} onEdit={onEdit} onDelete={onDelete}
          onViewCell={onViewLGLeaderCell} onProceedToClose={onProceedToClose} onPickTimothy={onPickTimothy}/>}
    </div>
  );
}

function SubLeaderCloseScreen({ gender, leader, subLeader, members, loading, goHome, goGender, goLeader, goCloseCell, goSubLeader, onAdd, onEdit, onDelete, onPickDeepLeader }) {
  const acc  = gender==="Boys"?"acc-boys":"acc-girls";

  const list = members
    .filter(m=>String(m.ParentID)===String(subLeader.ID)&&m.Status==="Close Cell")
    .sort((a,b)=>{
      const ca = members.filter(x=>String(x.ParentID)===String(a.ID)).length;
      const cb = members.filter(x=>String(x.ParentID)===String(b.ID)).length;
      return cb - ca;
    });

  const groups={};
  list.forEach(m=>{
    const day=(m.ScheduleDay||"").trim(),time=(m.ScheduleTime||"").trim();
    const key=day||time?`${day}||${time}`:"||";
    if(!groups[key]) groups[key]={day,time,members:[]};
    groups[key].members.push(m);
  });
  const sorted=Object.keys(groups).sort((a,b)=>{
    const ga=groups[a],gb=groups[b];
    if(!ga.day&&!ga.time) return 1; if(!gb.day&&!gb.time) return -1;
    const ai=DAYS.indexOf(ga.day),bi=DAYS.indexOf(gb.day);
    if(ai!==bi){if(ai===-1) return 1; if(bi===-1) return -1; return ai-bi;}
    return (ga.time||"").localeCompare(gb.time||"");
  });
  return (
    <div className={`screen ${acc}`}>
      <Breadcrumb crumbs={[
        {label:"Home",onClick:goHome},{label:gender,onClick:goGender},
        {label:leader.Name,onClick:goLeader},{label:"Close Cell",onClick:goCloseCell},{label:subLeader.Name,onClick:goSubLeader},
      ]} current="Close Cell"/>
      <div className="screen-head">
        <div>
          <span className="eyebrow-sm">Close Cell · {subLeader.Name}</span>
          <h1>Leaders</h1>
          <p className="sub">Disciples who now lead their own lifegroup.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add leader</button>
      </div>
      {loading?<div className="empty"><Loader2 size={22} className="spin"/></div>
      :list.length===0?(<div className="empty"><p className="empty-title">No close cell leaders yet</p><button className="btn-primary" onClick={onAdd}><Plus size={15}/>Add leader</button></div>)
      :<div className="groups">
        {sorted.map(key=>{
          const{day,time,members:grpMembers}=groups[key];
          const hasSchedule=day||time;
          return(
            <div key={key} className="day-group">
              <div className="day-group-head">
                <span className="day-group-label">{hasSchedule?(<>{day&&<><Calendar size={13}/>{day}</>}{time&&<><Clock size={13} style={{marginLeft:day?6:0}}/>{formatTime(time)}</>}</>):<span style={{color:"var(--faint)"}}>No schedule</span>}</span>
                <span className="day-group-count">{grpMembers.length} {grpMembers.length===1?"leader":"leaders"}</span>
              </div>
              <div className="subldr-list">
                {grpMembers.map(m=>{
                  const ownMembers=members.filter(x=>String(x.ParentID)===String(m.ID));
                  return(
                    <div key={m.ID} className="subldr-row">
                      <button className="subldr-main" onClick={()=>onPickDeepLeader(m)}>
                        <Avatar url={m.PhotoURL} name={m.Name} size={34}/>
                        <div className="subldr-info"><span className="subldr-name">{m.Name}</span>{m.LifegroupLocation&&<span className="subldr-loc"><MapPin size={11}/>{m.LifegroupLocation}</span>}</div>
                        <div className="subldr-meta"><StatusBadge status={m.LifegroupStatus}/>{m.Notes&&<NotesBadge notes={m.Notes}/>}<span className="subldr-count">{lgLabel(countLifegroups(ownMembers))}</span><ChevronRight size={15} style={{color:"var(--faint)"}}/></div>
                      </button>
                      <div className="subldr-actions">
                        <TrackList member={m}/>
                        <button className="icon-btn" onClick={()=>onEdit(m)}><Pencil size={14}/></button>
                        <button className="icon-btn icon-btn-danger" onClick={()=>onDelete(m)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  APP ROOT
// ════════════════════════════════════════════════════════════════════
export default function App() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [route,   setRoute]   = useState({screen:"home"});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  // FIX: separate photo-uploading state so button label is informative
  const [photoSaving, setPhotoSaving] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [ldrModal,  setLdrModal]  = useState(false);
  const [savingLdr, setSavingLdr] = useState(false);
  const [photoSavingLdr, setPhotoSavingLdr] = useState(false);
  const [editingLdr, setEditingLdr] = useState(null);
  const [proceedTarget, setProceedTarget] = useState(null);
  const [proceeding,    setProceeding]    = useState(false);
  const [timothyTarget, setTimothyTarget] = useState(null);
  const [savingTimothy, setSavingTimothy] = useState(false);

  const [textSize, setTextSize] = useState("normal");
  const SIZE_STEPS = ["normal", "large", "xlarge"];
  const SIZE_LABELS = { normal: "Normal", large: "Large", xlarge: "Extra Large" };
  function cycleTextSize() {
    setTextSize(prev => {
      const i = SIZE_STEPS.indexOf(prev);
      return SIZE_STEPS[(i + 1) % SIZE_STEPS.length];
    });
  }

  const leaders = members.filter(m => !m.ParentID || String(m.ParentID).trim() === "");

  const load = useCallback(async()=>{
    setLoading(true); setError("");
    try { const data=await apiGet(); setMembers(data.members||[]); }
    catch(err) {
      const msg = err.name === "AbortError"
        ? "Request timed out. Check your connection and try again."
        : "Couldn't load from the sheet. Check connection and try again.";
      setError(msg);
    }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{load();},[load]);

  const navigate = useCallback((newRoute) => {
    setRoute(newRoute);
    window.history.pushState({ jcrRoute: newRoute }, "");
  }, []);

  useEffect(() => {
    window.history.replaceState({ jcrRoute: { screen: "home" } }, "");
  }, []);

  useEffect(() => {
    function onPopState(event) {
      const r = event.state && event.state.jcrRoute;
      setRoute(r || { screen: "home" });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goHome      = ()        => navigate({screen:"home"});
  const goGender    = g         => navigate({screen:"gender",gender:g});
  const goLeader    = (g,l)     => navigate({screen:"leader",gender:g,leader:l});
  const goOpenCell  = (g,l)     => navigate({screen:"open",gender:g,leader:l});
  const goCloseCell = (g,l)     => navigate({screen:"close",gender:g,leader:l});
  const goSubLeader = (g,l,sub) => navigate({screen:"subleader",gender:g,leader:l,subLeader:sub});
  const goSubOpen   = (g,l,sub) => navigate({screen:"subopen",gender:g,leader:l,subLeader:sub});
  const goSubClose  = (g,l,sub) => navigate({screen:"subclose",gender:g,leader:l,subLeader:sub});
  const goLGLeaderCell = (g,l,lglm,fromScreen) => navigate({screen:"lglcell",gender:g,leader:l,lglMember:lglm,fromScreen});

  function currentParentId() {
    if (route.screen==="open"||route.screen==="close") return String(route.leader.ID);
    if (route.screen==="subleader"||route.screen==="subopen"||route.screen==="subclose") return String(route.subLeader.ID);
    if (route.screen==="lglcell") return String(route.lglMember.ID);
    return "";
  }
  function currentDefaultStatus() {
    if (route.screen==="close"||route.screen==="subclose") return "Close Cell";
    return "Open Cell";
  }
  function currentLeaderName() {
    if (route.screen==="lglcell") return route.lglMember.Name;
    if (route.screen==="subopen"||route.screen==="subclose"||route.screen==="subleader") return route.subLeader.Name;
    if (route.screen==="open"||route.screen==="close") return route.leader.Name;
    return "";
  }
  function currentExistingDays() {
    const pid=currentParentId(), status=currentDefaultStatus();
    return [...new Set(
      members.filter(m=>String(m.ParentID)===pid&&(m.Status||"Open Cell")===status)
        .map(m=>(m.ScheduleDay||"").trim()).filter(Boolean)
    )];
  }

  // ── FIX: handleSaveMember
  //
  // The previous version bundled PhotoData into the same apiPost call
  // as the member save. If Google Drive was slow or the request timed
  // out, the promise would hang indefinitely — leaving `saving = true`
  // and the button permanently stuck.
  //
  // Now we use fetchWithTimeout (60 s) so the AbortController fires if
  // GAS doesn't respond in time, and the catch block can reset saving.
  // We also surface a clear error message instead of silently hanging.
  //
  // The photo-upload step now shows "Uploading photo…" on the button
  // via the `photoSaving` state, so users know what's happening.
  async function handleSaveMember(form) {
    const hasPhoto = !!form.PhotoData;

    // Phase 1: if there's a new photo, show "Uploading photo…"
    if (hasPhoto) setPhotoSaving(true);
    // Phase 2: member row write shows "Saving…"
    setSaving(true);

    try {
      const pid = currentParentId();

      if (editing) {
        // --- UPDATE ---
        const res = await apiPost({action:"updateMember", id:editing.ID, member:form});
        // Once the photo upload (which happens inside GAS) is done, clear that state
        if (hasPhoto) setPhotoSaving(false);

        const { PhotoData, ...rest } = form;
        const patch = res.photoUrl ? { ...rest, PhotoURL: res.photoUrl } : rest;
        setMembers(prev=>prev.map(m=>String(m.ID)===String(editing.ID)?{...m,...patch}:m));

      } else if (form.Names) {
        // --- CREATE MULTIPLE ---
        const { Names, PhotoData, ...shared } = form;
        const created = [];
        for (const nm of Names) {
          const member = { ...shared, Name: nm, ParentID: pid };
          if (PhotoData) member.PhotoData = PhotoData;
          const res = await apiPost({action:"createMember", member});
          if (hasPhoto) setPhotoSaving(false); // clear after first upload
          created.push({ ...shared, Name: nm, ParentID: pid, ID: res.id, PhotoURL: res.photoUrl || "" });
        }
        setMembers(prev=>[...prev, ...created]);

      } else {
        // --- CREATE SINGLE ---
        const { PhotoData, ...rest } = form;
        const res = await apiPost({action:"createMember", member:{...form, ParentID:pid}});
        if (hasPhoto) setPhotoSaving(false);
        setMembers(prev=>[...prev, {...rest, ParentID:pid, ID:res.id, PhotoURL:res.photoUrl||""}]);
      }

      setModalOpen(false);
      setEditing(null);

    } catch(err) {
      const msg = err.name === "AbortError"
        ? "Photo upload timed out (60 s). Try a smaller image, or save without a photo and add it later."
        : `Couldn't save — ${err.message || "please try again."}`;
      setError(msg);
    } finally {
      // FIX: always reset BOTH flags so the button never stays stuck
      setPhotoSaving(false);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if(!delTarget) return;
    setDeleting(true);
    try {
      await apiPost({action:"deleteMember",id:delTarget.ID});
      setMembers(prev=>prev.filter(m=>String(m.ID)!==String(delTarget.ID)));
      setDelTarget(null);
    } catch(err) {
      setError(err.name === "AbortError" ? "Request timed out. Try again." : "Couldn't remove. Try again.");
    }
    finally { setDeleting(false); }
  }

  async function handleSaveLeader(form) {
    const hasPhoto = !!form.PhotoData;
    if (hasPhoto) setPhotoSavingLdr(true);
    setSavingLdr(true);
    try {
      if (editingLdr) {
        // --- UPDATE existing leader (name / profile photo) ---
        const res = await apiPost({action:"updateMember", id:editingLdr.ID, member:form});
        if (hasPhoto) setPhotoSavingLdr(false);
        const { PhotoData, ...rest } = form;
        const patch = res.photoUrl ? { ...rest, PhotoURL: res.photoUrl } : rest;
        setMembers(prev=>prev.map(m=>String(m.ID)===String(editingLdr.ID)?{...m,...patch}:m));
      } else {
        // --- CREATE new leader ---
        const res = await apiPost({action:"createRoot", member:form});
        if (hasPhoto) setPhotoSavingLdr(false);
        const { PhotoData, ...rest } = form;
        setMembers(prev=>[...prev,{...rest,ID:res.id,ParentID:"",Status:"Close Cell",LifegroupStatus:"Active",PhotoURL:res.photoUrl||""}]);
      }
      setLdrModal(false);
      setEditingLdr(null);
    } catch(err) {
      const msg = err.name === "AbortError"
        ? "Photo upload timed out. Try a smaller image, or save without a photo."
        : (editingLdr ? "Couldn't save changes. Try again." : "Couldn't add leader. Try again.");
      setError(msg);
    } finally {
      setPhotoSavingLdr(false);
      setSavingLdr(false);
    }
  }

  async function handleProceedToCloseCell() {
    if (!proceedTarget) return;
    setProceeding(true);
    try {
      const updatedForm = {
        Name:              proceedTarget.Name,
        LifegroupLocation: proceedTarget.LifegroupLocation||"",
        ScheduleDay:       proceedTarget.ScheduleDay||"",
        ScheduleTime:      proceedTarget.ScheduleTime||"",
        Status:            "Close Cell",
        LifegroupStatus:   proceedTarget.LifegroupStatus||"Active",
        Notes:             proceedTarget.Notes||"",
        SUYNL:             toBool(proceedTarget.SUYNL)?"TRUE":"FALSE",
        LIFECLASS:         toBool(proceedTarget.LIFECLASS)?"TRUE":"FALSE",
        ENCOUNTER:         toBool(proceedTarget.ENCOUNTER)?"TRUE":"FALSE",
        WATERBAPTISM:      toBool(proceedTarget.WATERBAPTISM)?"TRUE":"FALSE",
        SOL1:              toBool(proceedTarget.SOL1)?"TRUE":"FALSE",
        SOL2:              toBool(proceedTarget.SOL2)?"TRUE":"FALSE",
        REENCOUNTER:       toBool(proceedTarget.REENCOUNTER)?"TRUE":"FALSE",
        SOL3:              toBool(proceedTarget.SOL3)?"TRUE":"FALSE",
        LGLEADER:          toBool(proceedTarget.LGLEADER)?"TRUE":"FALSE",
      };
      await apiPost({action:"updateMember", id:proceedTarget.ID, member:updatedForm});
      setMembers(prev=>prev.map(m=>
        String(m.ID)===String(proceedTarget.ID) ? {...m, Status:"Close Cell"} : m
      ));
      setProceedTarget(null);
    } catch(err) {
      setError(err.name === "AbortError" ? "Request timed out. Try again." : "Couldn't proceed. Try again.");
    }
    finally { setProceeding(false); }
  }

  function handleViewLGLeaderCell(lglMember) {
    if (route.screen === "open") {
      goLGLeaderCell(route.gender, route.leader, lglMember, "open");
    } else if (route.screen === "subopen") {
      goLGLeaderCell(route.gender, route.leader, lglMember, "subopen");
    }
  }

  function handleProceedToCloseClick(member) {
    setProceedTarget(member);
  }

  const proceedMembersUnder = proceedTarget
    ? members.filter(m=>String(m.ParentID)===String(proceedTarget.ID))
    : [];

  function handlePickTimothy(groupMembers) {
    setTimothyTarget(groupMembers);
  }

  async function handleSaveTimothy(selectedIds) {
    if (!timothyTarget) return;
    setSavingTimothy(true);
    try {
      const changed = timothyTarget.filter(m => {
        const now  = toBool(m.TIMOTHY);
        const want = selectedIds.includes(m.ID);
        return now !== want;
      });
      for (const m of changed) {
        const want = selectedIds.includes(m.ID) ? "TRUE" : "FALSE";
        await apiPost({ action:"updateMember", id:m.ID, member:{ TIMOTHY: want } });
      }
      const changedIds = new Set(changed.map(m=>m.ID));
      setMembers(prev => prev.map(m =>
        changedIds.has(m.ID)
          ? { ...m, TIMOTHY: selectedIds.includes(m.ID) ? "TRUE" : "FALSE" }
          : m
      ));
      setTimothyTarget(null);
    } catch(err) {
      setError(err.name === "AbortError" ? "Request timed out. Try again." : "Couldn't update Timothy. Try again.");
    }
    finally { setSavingTimothy(false); }
  }

  return (
    <div className="shell" data-textsize={textSize}>
      <style>{CSS}</style>
      <header className="topbar">
        <button className="brand" onClick={goHome}>
          <span className="brand-mark">JCR</span>
          <span className="brand-name">Sonny Claudio's Cell Report</span>
        </button>
        <div style={{display:"flex",gap:6}}>
          <button
            className={`icon-btn resize-btn${textSize!=="normal"?" resize-btn-active":""}`}
            onClick={cycleTextSize}
            title="Resize text"
          >
            <ZoomIn size={15}/>
            <span className="resize-btn-label">{SIZE_LABELS[textSize]}</span>
          </button>
          {route.screen!=="home"&&
            <button className="icon-btn" onClick={goHome} title="Home"><Home size={15}/></button>}
          <button className="icon-btn" onClick={load} title="Refresh">
            <RefreshCw size={15} className={loading?"spin":""}/>
          </button>
        </div>
      </header>

      <main className="main">
        {route.screen==="home"&&<HomeScreen members={members} leaders={leaders} loading={loading} error={error} onRetry={load} onEnter={goGender}/>}
        {route.screen==="gender"&&<GenderScreen gender={route.gender} leaders={leaders} members={members} loading={loading} goHome={goHome} onPickLeader={l=>goLeader(route.gender,l)} onAddLeader={()=>{setEditingLdr(null);setLdrModal(true);}} onEditLeader={l=>{setEditingLdr(l);setLdrModal(true);}}/>}
        {route.screen==="leader"&&<LeaderScreen gender={route.gender} leader={route.leader} members={members} goHome={goHome} goGender={()=>goGender(route.gender)} onPickCell={cell=>cell==="Open Cell"?goOpenCell(route.gender,route.leader):goCloseCell(route.gender,route.leader)} onEditLeader={l=>{setEditingLdr(l);setLdrModal(true);}}/>}
        {route.screen==="open"&&<OpenCellScreen gender={route.gender} leader={route.leader} members={members} loading={loading} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} onAdd={()=>{setEditing(null);setModalOpen(true);}} onEdit={m=>{setEditing(m);setModalOpen(true);}} onDelete={m=>setDelTarget(m)} onViewLGLeaderCell={handleViewLGLeaderCell} onProceedToClose={handleProceedToCloseClick} onPickTimothy={handlePickTimothy}/>}
        {route.screen==="close"&&<CloseCellScreen gender={route.gender} leader={route.leader} members={members} loading={loading} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} onAdd={()=>{setEditing(null);setModalOpen(true);}} onEdit={m=>{setEditing(m);setModalOpen(true);}} onDelete={m=>setDelTarget(m)} onPickSubLeader={sub=>goSubLeader(route.gender,route.leader,sub)}/>}
        {route.screen==="subleader"&&<SubLeaderScreen gender={route.gender} leader={route.leader} subLeader={route.subLeader} members={members} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} goCloseCell={()=>goCloseCell(route.gender,route.leader)} onPickCell={cell=>cell==="Open Cell"?goSubOpen(route.gender,route.leader,route.subLeader):goSubClose(route.gender,route.leader,route.subLeader)}/>}
        {route.screen==="subopen"&&<SubLeaderOpenScreen gender={route.gender} leader={route.leader} subLeader={route.subLeader} members={members} loading={loading} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} goCloseCell={()=>goCloseCell(route.gender,route.leader)} goSubLeader={()=>goSubLeader(route.gender,route.leader,route.subLeader)} onAdd={()=>{setEditing(null);setModalOpen(true);}} onEdit={m=>{setEditing(m);setModalOpen(true);}} onDelete={m=>setDelTarget(m)} onViewLGLeaderCell={handleViewLGLeaderCell} onProceedToClose={handleProceedToCloseClick} onPickTimothy={handlePickTimothy}/>}
        {route.screen==="subclose"&&<SubLeaderCloseScreen gender={route.gender} leader={route.leader} subLeader={route.subLeader} members={members} loading={loading} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} goCloseCell={()=>goCloseCell(route.gender,route.leader)} goSubLeader={()=>goSubLeader(route.gender,route.leader,route.subLeader)} onAdd={()=>{setEditing(null);setModalOpen(true);}} onEdit={m=>{setEditing(m);setModalOpen(true);}} onDelete={m=>setDelTarget(m)} onPickDeepLeader={deep=>navigate({screen:"subleader",gender:route.gender,leader:route.leader,subLeader:deep})}/>}
        {route.screen==="lglcell"&&<LGLeaderCellScreen gender={route.gender} leader={route.leader} lglMember={route.lglMember} members={members} loading={loading} goHome={goHome} goGender={()=>goGender(route.gender)} goLeader={()=>goLeader(route.gender,route.leader)} goOpenCell={()=>goOpenCell(route.gender,route.leader)} onAdd={()=>{setEditing(null);setModalOpen(true);}} onEdit={m=>{setEditing(m);setModalOpen(true);}} onDelete={m=>setDelTarget(m)} onPickTimothy={handlePickTimothy}/>}
      </main>

      <MemberModal
        open={modalOpen}
        onClose={()=>{ if(!saving && !photoSaving){ setModalOpen(false); setEditing(null); } }}
        onSave={handleSaveMember}
        initial={editing}
        leaderName={currentLeaderName()}
        defaultStatus={currentDefaultStatus()}
        existingDays={currentExistingDays()}
        saving={saving}
        photoSaving={photoSaving}
      />
      <LeaderModal
        open={ldrModal}
        onClose={()=>{ if(!savingLdr && !photoSavingLdr){ setLdrModal(false); setEditingLdr(null); } }}
        onSave={handleSaveLeader}
        gender={route.gender}
        saving={savingLdr}
        photoSaving={photoSavingLdr}
        initial={editingLdr}
      />
      <ConfirmDelete open={!!delTarget} name={delTarget?.Name} onCancel={()=>setDelTarget(null)} onConfirm={handleDelete} deleting={deleting}/>
      <ProceedToCloseCellModal
        open={!!proceedTarget}
        member={proceedTarget}
        membersUnder={proceedMembersUnder}
        onCancel={()=>setProceedTarget(null)}
        onConfirm={handleProceedToCloseCell}
        processing={proceeding}
      />
      <PickTimothyModal
        open={!!timothyTarget}
        groupMembers={timothyTarget}
        onCancel={()=>setTimothyTarget(null)}
        onConfirm={handleSaveTimothy}
        saving={savingTimothy}
      />
    </div>
  );
}

const CSS = `
:root {
  color-scheme: light;
  --paper:  #FAF6EE; --raised: #FFFFFF; --ink: #1F2A24;
  --faint:  #9C9485; --line:   #E4DDCC;
  --sage:   #5B7A63; --sage-d: #44604C;
  --gold:   #C99A4B;
  --rose:   #B8757A; --rose-d: #9C5B61;
  --blue:   #5C7C9C; --blue-d: #46647F;
  --danger: #B23B3B; --green:  #3A7D5C;
  --amber:  #8B6914;
  --lgl:    #6B4FA0; --lgl-d:  #52388A;
  --tim:    #B8850C; --tim-d:  #8A6208;
}
*{box-sizing:border-box;margin:0;padding:0;}
html{color-scheme:light;}
body{background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color-scheme:light;}
.shell{color-scheme:light;}
.spin{animation:spin .9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--line);background:var(--paper);}
.brand{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;}
.brand-mark{background:var(--sage);color:var(--paper);font-weight:700;font-size:13px;letter-spacing:.04em;padding:6px 9px;border-radius:6px;}
.brand-name{font-size:16px;font-weight:700;color:var(--ink);}
.main{max-width:880px;margin:0 auto;padding:40px 24px 80px;}

.bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--faint);margin-bottom:22px;flex-wrap:wrap;}
.bc-btn{background:none;border:none;font-size:13px;color:var(--faint);cursor:pointer;}
.bc-btn:hover{color:var(--ink);text-decoration:underline;}
.bc-cur{font-size:13px;color:var(--ink);font-weight:600;}

.screen-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;}
.screen-head h1{font-size:30px;font-weight:700;margin-bottom:4px;}
.screen-head-leader{display:flex;align-items:center;gap:16px;}
.eyebrow-sm{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:4px;}
.sub{font-size:14px;color:var(--faint);}
.acc-boys  .screen-head h1{color:var(--blue-d);}
.acc-girls .screen-head h1{color:var(--rose-d);}

.error-box{display:flex;align-items:center;gap:8px;background:#F8E9E5;color:var(--danger);border:1px solid #E5BDB5;border-radius:10px;padding:12px 16px;font-size:14px;margin-bottom:28px;}
.link-btn{background:none;border:none;font-size:13px;color:var(--faint);cursor:pointer;}

.home-wrap{max-width:640px;}
.home-hero{margin-bottom:36px;}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--sage-d);font-weight:700;margin-bottom:14px;}
.home-hero h1{font-size:42px;line-height:1.08;font-weight:700;letter-spacing:-.01em;margin-bottom:16px;}
.lede{font-size:16px;line-height:1.6;color:#5B5447;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--line);}
.stat{display:flex;flex-direction:column;padding:0 20px 0 0;border-right:1px solid var(--line);}
.stat:not(:first-child){padding:0 20px;}
.stat:last-child{border-right:none;}
.stat-n{font-size:34px;font-weight:700;color:var(--sage-d);}
.stat-l{font-size:13px;color:var(--faint);margin-top:2px;}

.doors{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.door{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:28px 24px;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;}
.door:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(31,42,36,.08);}
.door-boys{color:var(--blue-d);} .door-boys:hover{border-color:var(--blue);}
.door-girls{color:var(--rose-d);} .door-girls:hover{border-color:var(--rose);}
.door-network-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin-top:10px;}
.door-title{font-size:20px;font-weight:700;color:var(--ink);line-height:1.2;}
.door-count{font-size:13px;color:var(--faint);margin-top:2px;}
.door-go{margin-top:12px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:2px;}

.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;align-items:stretch;}
.leader-card-wrap{display:flex;}
.leader-card{width:100%;text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:transform .15s,box-shadow .15s;}
.leader-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(31,42,36,.08);}
.lc-avatar-row{display:flex;align-items:center;gap:10px;}
.lc-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);}
.lc-name{font-size:18px;font-weight:700;}
.lc-counts{display:flex;gap:6px;flex-wrap:wrap;}
.lc-pill{font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;}
.lc-open{background:#EAF4F0;color:var(--sage-d);}
.lc-close{background:#F0F4FA;color:var(--blue-d);}
.lc-days{display:flex;gap:4px;flex-wrap:wrap;min-height:22px;}
.go-lnk{font-size:12px;font-weight:700;color:var(--sage-d);display:flex;align-items:center;margin-top:auto;padding-top:4px;}

.cell-split{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.cell-card{text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:24px;cursor:pointer;display:flex;flex-direction:column;gap:12px;transition:transform .15s,box-shadow .15s;}
.cell-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(31,42,36,.08);}
.cell-open:hover{border-color:var(--sage);}
.cell-close:hover{border-color:var(--blue);}
.cc-top{display:flex;align-items:baseline;gap:10px;}
.cc-count{font-size:36px;font-weight:700;}
.cell-open  .cc-count{color:var(--sage-d);}
.cell-close .cc-count{color:var(--blue-d);}
.cc-label{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);}
.cc-days{display:flex;gap:4px;flex-wrap:wrap;}
.cc-desc{font-size:14px;color:#5B5447;line-height:1.5;}

.groups{display:flex;flex-direction:column;gap:24px;}
.day-group{display:flex;flex-direction:column;gap:10px;}
.day-group-head{display:flex;align-items:center;justify-content:space-between;padding:0 2px;gap:10px;flex-wrap:wrap;}
.day-group-label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--ink);}
.day-group-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.day-group-count{font-size:12px;color:var(--faint);}

.day-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;background:#EEF4FF;color:var(--blue-d);border-radius:20px;padding:3px 8px;}

.member-list{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.member-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:var(--raised);padding:14px 18px;}

.avatar{border-radius:50%;object-fit:cover;flex-shrink:0;background:#EFEAE0;}
.lc-avatar-clickable{display:inline-flex;border-radius:50%;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;}
.lc-avatar-clickable:hover{transform:scale(1.06);box-shadow:0 0 0 3px rgba(0,0,0,0.06);}
.lc-avatar-clickable:active{transform:scale(0.97);}
.lc-avatar-clickable:focus-visible{outline:2px solid var(--accent,#7a8f6e);outline-offset:2px;}
.photo-view-overlay{background:rgba(0,0,0,.82);z-index:1200;}
.photo-view-inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:92vw;}
.photo-view-img{width:min(78vw,420px);height:min(78vw,420px);border-radius:50%;object-fit:cover;box-shadow:0 10px 40px rgba(0,0,0,.5);background:#EFEAE0;}
.photo-view-name{color:#fff;font-size:16px;font-weight:600;text-align:center;}
.photo-view-close{position:absolute;top:-44px;right:0;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;}
.photo-view-close:hover{background:rgba(255,255,255,.28);}
@media (max-width:480px){.photo-view-close{top:-40px;}}
.avatar-fallback{display:flex;align-items:center;justify-content:center;color:var(--faint);}

.photo-picker{display:flex;align-items:center;gap:12px;}
.photo-picker-preview{width:56px;height:56px;border-radius:50%;background:#EFEAE0;color:var(--faint);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1px solid var(--line);}
.photo-picker-preview img{width:100%;height:100%;object-fit:cover;}
.photo-picker-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.btn-photo{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;font-size:13px;}
.btn-photo-remove{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--danger);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;padding:4px 6px;}
.btn-photo-remove:hover{text-decoration:underline;}
.member-row-lgl{background:#FAF6FF;border-left:3px solid var(--lgl);}
.member-rank{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--paper);border:1px solid var(--line);font-size:11px;font-weight:700;color:var(--faint);display:flex;align-items:center;justify-content:center;margin-top:16px;}
.member-main{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;}
.member-name-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.member-name{font-weight:700;font-size:15px;}
.member-loc{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--faint);}
.member-info-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--faint);margin-top:2px;}
.member-info-item{display:flex;align-items:center;gap:3px;}
.member-info-address{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.member-side{display:flex;align-items:center;gap:8px;flex-shrink:0;}

.lgl-action-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:4px;}
.btn-view-cell{display:inline-flex;align-items:center;gap:5px;background:#F2EEF9;border:1px solid #C9B8E8;color:var(--lgl-d);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
.btn-view-cell:hover{background:#E8E0F7;}
.btn-proceed-close{display:inline-flex;align-items:center;gap:5px;background:#FFF3E0;border:1px solid #FFCC80;color:#E65100;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
.btn-proceed-close:hover{background:#FFE0B2;}

.lgl-notice{display:flex;align-items:flex-start;gap:10px;background:#F2EEF9;border:1px solid #C9B8E8;border-radius:10px;padding:12px 16px;font-size:13px;color:var(--lgl-d);line-height:1.5;margin-bottom:24px;}
.lgl-notice svg{flex-shrink:0;margin-top:1px;}

.btn-pick-timothy{display:inline-flex;align-items:center;gap:5px;background:var(--raised);border:1px dashed var(--tim);color:var(--tim-d);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
.btn-pick-timothy:hover{background:#FCF3DE;}
.timothy-chip{display:inline-flex;align-items:center;gap:5px;background:#FCF3DE;border:1px solid var(--tim);color:var(--tim-d);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:background .15s;}
.timothy-chip:hover{background:#F9E7BE;}

.timothy-list{display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;}
.timothy-opt{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:14px;cursor:pointer;color:var(--ink);}
.timothy-opt-on{border-color:var(--tim);background:#FCF3DE;}
.timothy-opt input{accent-color:var(--tim);width:16px;height:16px;}

.track-pills{display:flex;flex-wrap:wrap;gap:5px;}
.track-pill{font-size:11px;font-weight:700;color:var(--ink);background:#FBF0DC;border:1px solid var(--gold);border-radius:6px;padding:3px 8px;line-height:1.2;}
.track-pill-lgl{background:#F2EEF9;border-color:#C9B8E8;color:var(--lgl-d);}
.track-list-empty{font-size:12px;color:var(--faint);font-weight:400;font-style:italic;}

.subldr-list{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.subldr-row{background:var(--raised);display:flex;flex-direction:column;}
.subldr-main{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 8px;cursor:pointer;background:none;border:none;text-align:left;width:100%;gap:12px;}
.subldr-main:hover{background:#F8F5EF;}
.subldr-info{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.subldr-name{font-size:15px;font-weight:700;}
.subldr-loc{font-size:12px;color:var(--faint);display:flex;align-items:center;gap:3px;}
.subldr-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.subldr-count{font-size:12px;color:var(--faint);font-weight:700;}
.subldr-actions{display:flex;align-items:center;gap:10px;padding:4px 18px 12px;border-top:1px solid var(--line);flex-wrap:wrap;}
.subldr-actions .track-pills{flex:1;min-width:120px;}

.badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:20px;padding:3px 8px;}
.badge-green{background:#E6F4ED;color:var(--green);}
.badge-red{background:#F8E9E5;color:var(--danger);}
.badge-close{background:#EEF4FF;color:var(--blue-d);}
.badge-open{background:#EAF6EC;color:#3A7D44;border-radius:20px;font-size:11px;font-weight:700;padding:3px 9px;}
.member-detail-modal .modal-body{gap:16px;}
.md-top{display:flex;align-items:center;gap:14px;}
.md-top-center{flex-direction:column;text-align:center;gap:10px;}
.md-top-info{display:flex;flex-direction:column;gap:6px;min-width:0;}
.md-avatar-wrap{position:relative;display:inline-flex;}
.md-batch-badge{position:absolute;top:50%;left:100%;transform:translate(6px,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;background:#FBF0DC;border:1.5px solid var(--gold);border-radius:12px;padding:4px 10px;min-width:44px;box-shadow:0 1px 3px rgba(0,0,0,.08);}
.md-batch-badge-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);line-height:1;}
.md-batch-badge-no{font-size:20px;font-weight:800;color:var(--ink);line-height:1.2;}
.md-name{font-size:18px;font-weight:700;}
.md-badges{display:flex;flex-wrap:wrap;gap:6px;}
.md-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;}
.md-field{display:flex;flex-direction:column;gap:2px;min-width:0;}
.md-field-wide{grid-column:1 / -1;}
.md-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--faint);}
.md-value{font-size:14px;color:var(--ink);word-break:break-word;}
.md-tracks{border-top:1px solid rgba(31,42,36,0.1);padding-top:14px;}
.badge-notes{background:#FEF3C7;color:var(--amber);}
.badge-lgl{background:#F2EEF9;color:var(--lgl-d);}
.badge-timothy{background:#FCF3DE;color:var(--tim-d);}
.member-row-close{background:#F5F8FF;}

.btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--sage);color:var(--paper);border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit;}
.btn-primary:hover{background:var(--sage-d);}
.btn-primary:disabled{opacity:.6;cursor:default;}
.btn-ghost{background:none;border:1px solid var(--line);border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit;}
.btn-ghost:hover{background:#F1ECDF;}
.btn-ghost:disabled{opacity:.6;cursor:default;}
.btn-danger{display:inline-flex;align-items:center;gap:6px;background:var(--danger);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}
.btn-danger:disabled{opacity:.6;}
.btn-seed{display:inline-flex;align-items:center;gap:6px;background:#E65100;color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}
.btn-seed:disabled{opacity:.6;}
.btn-seed:hover:not(:disabled){background:#BF360C;}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--faint);cursor:pointer;padding:6px;border-radius:6px;}
.icon-btn:hover{background:#F1ECDF;color:var(--ink);}
.icon-btn-danger:hover{background:#F8E9E5;color:var(--danger);}

.resize-btn{width:auto;gap:5px;padding:6px 10px;border:1px solid var(--line);}
.resize-btn-label{font-size:11px;font-weight:700;}
.resize-btn-active{background:#EAF4F0;border-color:var(--sage);color:var(--sage-d);}
.resize-btn-active:hover{background:#DCEEE3;}

.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:60px 20px;text-align:center;border:1px dashed var(--line);border-radius:14px;color:var(--faint);}
.empty-title{font-weight:700;color:var(--ink);}
.empty-sub{font-size:14px;margin-bottom:4px;}

.overlay{position:fixed;inset:0;background:rgba(31,42,36,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;overflow:auto;}
.crop-overlay{z-index:1100;}
.modal{background:var(--raised);border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.crop-modal{max-width:640px;}
.modal-sm{max-width:400px;}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 12px;}
.modal-head h2{font-size:19px;font-weight:700;}
.modal-body{padding:4px 22px 22px;display:flex;flex-direction:column;gap:18px;}
.modal-sub{font-size:13px;color:var(--faint);margin-top:-8px;}
.modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:6px;}
.field{display:flex;flex-direction:column;gap:6px;border:none;}
.field-row{display:flex;gap:12px;}
.field-row .field{flex:1;min-width:0;}
.field-readonly{background:#F0EEE7;color:var(--faint);cursor:default;}
.field>span{font-size:13px;font-weight:700;}
.field input[type=text],.field input[type=time],.field input[type=tel],.field input[type=date],.field input[type=email],.field input[type=number]{color-scheme:light;font-size:14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font-family:inherit;}
.field input[type=text]:focus,.field input[type=time]:focus,.field input[type=tel]:focus,.field input[type=date]:focus,.field input[type=email]:focus,.field input[type=number]:focus{outline:2px solid var(--sage);outline-offset:1px;}
.hint{font-size:12px;color:var(--faint);}
.hint-inline{font-size:12px;color:var(--faint);font-weight:400;}

.name-rows{display:flex;flex-direction:column;gap:8px;}
.name-row{display:flex;align-items:center;gap:6px;}
.name-row input[type=text]{flex:1;}
.name-row-remove{flex-shrink:0;color:var(--faint);}
.name-row-remove:hover{background:#F8E9E5;color:var(--danger);}
.btn-add-name{display:flex;align-items:center;gap:5px;align-self:flex-start;margin-top:2px;background:none;border:none;font-size:13px;font-weight:700;color:var(--sage-d);cursor:pointer;font-family:inherit;padding:4px 0;}
.btn-add-name:hover{text-decoration:underline;}

.day-toggle{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;width:fit-content;}
.dtog{background:var(--paper);border:none;padding:7px 14px;font-size:12px;font-weight:700;color:var(--faint);cursor:pointer;font-family:inherit;}
.dtog-on{background:var(--sage);color:var(--paper);}
.day-grid{display:flex;flex-wrap:wrap;gap:6px;}
.day-chip{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:6px 14px;font-size:13px;font-weight:700;color:var(--faint);cursor:pointer;font-family:inherit;}
.day-chip-on{background:var(--blue-d);border-color:var(--blue-d);color:#fff;}

.seg-group{display:flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;}
.seg{flex:1;background:var(--paper);border:none;padding:9px 10px;font-size:13px;font-weight:700;color:var(--faint);cursor:pointer;font-family:inherit;}
.seg-on{background:var(--sage);color:var(--paper);}
.seg-green{background:var(--green);color:#fff;}
.seg-red{background:var(--danger);color:#fff;}

.track-row{display:flex;flex-wrap:wrap;gap:8px;}
.chip{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:20px;padding:7px 12px;font-size:13px;cursor:pointer;color:var(--faint);}
.chip-on{border-color:var(--gold);background:#FBF0DC;color:var(--ink);}
.chip-lgl{border-color:#C9B8E8;}
.chip-lgl.chip-on{border-color:var(--lgl);background:#F2EEF9;color:var(--lgl-d);}
.chip input{accent-color:var(--gold);}
.chip-lgl input{accent-color:var(--lgl);}

.lgl-track-section{display:flex;flex-direction:column;gap:8px;margin-top:8px;padding-top:12px;border-top:1px solid var(--line);}
.lifeclass-batch-field{margin-top:10px;padding:10px 12px;background:#FBF3E4;border:1px solid #F0DCAE;border-radius:10px;}
.lgl-track-divider{display:flex;align-items:center;gap:8px;}
.lgl-track-divider span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--lgl-d);}

.confirm-txt{font-size:14px;line-height:1.5;color:#5B5447;}
.proceed-info{background:#FFF8F0;border:1px solid #FFCC80;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
.proceed-info-title{font-size:13px;font-weight:700;color:#5D4037;}
.proceed-member-list{display:flex;flex-wrap:wrap;gap:6px;}
.proceed-member-chip{font-size:12px;background:#FFF3E0;border:1px solid #FFCC80;border-radius:20px;padding:3px 10px;color:#BF360C;font-weight:700;}
.proceed-more{background:#F5F5F5;border-color:#E0E0E0;color:var(--faint);}

.shell{overflow-x:hidden;}
.main{max-width:880px;}
.modal{width:min(460px,92vw);}
.crop-modal{width:min(640px,92vw);}

.shell[data-textsize="large"] .main{zoom:1.12;}
.shell[data-textsize="large"] .topbar .brand-name,
.shell[data-textsize="large"] .topbar .resize-btn-label{font-size:115%;}
.shell[data-textsize="large"] .modal{zoom:1.1;max-height:85vh;}

.shell[data-textsize="xlarge"] .main{zoom:1.25;}
.shell[data-textsize="xlarge"] .topbar .brand-name,
.shell[data-textsize="xlarge"] .topbar .resize-btn-label{font-size:128%;}
.shell[data-textsize="xlarge"] .modal{zoom:1.2;max-height:80vh;}

@media(max-width:480px){
  .shell[data-textsize="large"] .main{zoom:1.08;}
  .shell[data-textsize="large"] .modal{zoom:1.05;}
  .shell[data-textsize="xlarge"] .main{zoom:1.15;}
  .shell[data-textsize="xlarge"] .modal{zoom:1.1;}
}

@media(max-width:560px){
  .doors,.cell-split{grid-template-columns:1fr;}
  .home-hero h1{font-size:32px;}
  .main{padding:28px 16px 60px;}
  .member-row{flex-wrap:wrap;}
  .stats{grid-template-columns:repeat(3,1fr);gap:10px;}
  .stat{padding:0 4px 0 0;border-right:none;}
  .stat:not(:first-child){padding:0 4px;}
  .stat-n{font-size:26px;}
  .stat-l{font-size:11px;line-height:1.3;}
  .lgl-action-row{flex-direction:column;align-items:flex-start;}
  .screen-head-leader{flex-direction:column;align-items:flex-start;gap:10px;}
}

@media(max-width:380px){
  .stats{grid-template-columns:1fr;gap:14px;}
  .stat{border-right:none;border-bottom:1px solid var(--line);padding:0 0 12px;}
  .stat:last-child{border-bottom:none;padding-bottom:0;}
  .stat:not(:first-child){padding:0 0 12px;}
}
`;
