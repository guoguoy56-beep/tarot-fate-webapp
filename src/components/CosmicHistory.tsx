"use client";

import Image from "next/image";
import { History, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tarotCardMap } from "@/data/tarotCards";
import { deleteJournalRecord, readJournalRecords, type JournalRecord } from "@/lib/journal-storage";

export function CosmicHistory({ onDelete, revision }: { onDelete: (record: JournalRecord) => void; revision: number }) {
  const [records, setRecords] = useState<JournalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    readJournalRecords(controller.signal).then((items) => {
      if (!controller.signal.aborted) { setRecords(items); setLoading(false); setError(""); }
    }).catch(() => {
      if (!controller.signal.aborted) { setError("历史记录读取失败，请重试。"); setLoading(false); }
    });
    return () => controller.abort();
  }, [reload, revision]);

  async function remove(record: JournalRecord) {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteJournalRecord(record);
      if (!mounted.current) return;
      setRecords((items) => items.filter((item) => item.kind !== record.kind || item.id !== record.id));
      setPending(null); setError(""); setNotice("已删除这条手记。");
      onDelete(record);
    } catch {
      if (mounted.current) setError("删除失败，请重试。手记仍保留在列表中。");
    } finally {
      if (mounted.current) setDeleting(false);
    }
  }

  return <section>
    <p className="cosmic-eyebrow">曾经停留的星光</p><h2>历史记录</h2>
    <p className="cosmic-dialog-intro">回看保存在当前账号中的问题、牌面与解读。再次登录后，仍可继续查看。</p>
    {error && <div className="cosmic-journal-error" role="alert">{error}{!records.length && <button className="cosmic-secondary" onClick={() => { setError(""); setLoading(true); setReload((value) => value + 1); }}>重新加载</button>}</div>}
    <p className="sr-only" role="status">{notice}</p>
    {loading ? <p className="cosmic-dialog-intro" role="status">正在读取手记…</p> : !records.length && !error ? <div className="cosmic-empty"><History size={34} strokeWidth={1} /><h3>还没有留下手记</h3><p>完成一次占卜后，可以在这里回望。</p></div> :
      <div className="cosmic-history-list">{records.map((record) => {
        const key = `${record.kind}:${record.id}`;
        const date = new Date(record.createdAt);
        return <article key={key} aria-label={record.question}>
          <div className="cosmic-history-meta"><span className="cosmic-sample-label">{record.kind === "sample" ? "示例手记" : "旧版手记"}</span>
            <time dateTime={Number.isNaN(date.getTime()) ? undefined : record.createdAt}>{Number.isNaN(date.getTime()) ? "日期未记录" : date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div>
          <h3>{record.question}</h3><p>{record.spreadName} · {record.cards.length} 张牌</p>
          <ol className="cosmic-history-cards">{record.cards.map((entry) => {
            const card = tarotCardMap.get(entry.cardId)!;
            return <li key={entry.position}><Image src={card.image} alt="" width={44} height={76} unoptimized style={{ transform: entry.orientation === "reversed" ? "rotate(180deg)" : undefined }} />
              <span>{entry.position}<strong>{card.nameCn}</strong><small>{entry.orientation === "upright" ? "正位" : "逆位"}</small></span></li>;
          })}</ol>
          <details><summary>查看完整手记</summary><div className="cosmic-history-reading">
            {record.kind === "sample" && <p className="cosmic-small-note">以下为保存当时的示例内容，仅供体验。</p>}
            {record.cards.map((entry) => <section key={entry.position}><h4>{entry.position} · {tarotCardMap.get(entry.cardId)!.nameCn} · {entry.orientation === "upright" ? "正位" : "逆位"}</h4>
              {entry.meaning && <><h5>牌面含义</h5><p>{entry.meaning}</p></>}
              {!!entry.keywords.length && <p className="cosmic-history-keywords">{entry.keywords.join(" · ")}</p>}
              <h5>与你的问题</h5><p>{entry.interpretation}</p></section>)}
            <section><h4>整体解读</h4><p className="cosmic-history-summary">{record.summary}</p></section>
          </div></details>
          <div className="cosmic-history-actions">{pending === key ? <>
            <span>删除后无法恢复这条手记。</span><button className="cosmic-secondary" disabled={deleting} onClick={() => remove(record)}>{deleting ? "删除中…" : "确认删除"}</button>
            <button className="cosmic-secondary" disabled={deleting} onClick={() => { setPending(null); setError(""); }}>取消</button>
          </> : <button className="cosmic-history-delete" disabled={deleting} onClick={() => { setPending(key); setError(""); }}><Trash2 size={14} />删除手记</button>}</div>
        </article>;
      })}</div>}
  </section>;
}
