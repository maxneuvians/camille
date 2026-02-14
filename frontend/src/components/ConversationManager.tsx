import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type {
    Conversation,
    ConversationMessage,
    MessageAnalysis,
    Theme,
} from "../types";
import "./ConversationManager.css";

interface ConversationListItem {
    id: string;
    themeTitle: string;
    startTime: number;
    endTime?: number;
    messageCount: number;
}

function formatDate(value: number) {
    return new Date(value).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function isUserMessage(msg: ConversationMessage) {
    return msg.role === "user";
}

export function ConversationManager() {
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [themesById, setThemesById] = useState<Record<string, Theme>>({});
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [conversationLoading, setConversationLoading] = useState(false);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState(localStorage.getItem("openai_api_key") || "");

    const loadList = useCallback(async () => {
        try {
            setListLoading(true);
            const [conversationData, themeData] = await Promise.all([
                api.getConversations(),
                api.getThemes(),
            ]);

            const themeMap = Object.fromEntries(themeData.map((theme) => [theme.id, theme]));
            setThemesById(themeMap);

            const items: ConversationListItem[] = conversationData
                .map((conv) => ({
                    id: conv.id,
                    startTime: conv.startTime,
                    endTime: conv.endTime,
                    messageCount: conv.messages.length,
                    themeTitle: themeMap[conv.themeId]?.title || "Thème inconnu",
                }))
                .sort((a, b) => b.startTime - a.startTime);

            setConversations(items);

            const hasSelected = selectedConversationId
                ? items.some((item) => item.id === selectedConversationId)
                : false;

            if (items.length === 0) {
                setSelectedConversationId(null);
                setSelectedConversation(null);
                setSelectedTimestamp(null);
            } else if (!hasSelected) {
                setSelectedConversationId(items[0].id);
            }
        } catch (err) {
            console.error(err);
            setError("Impossible de charger les conversations");
        } finally {
            setListLoading(false);
        }
    }, [selectedConversationId]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    useEffect(() => {
        const loadConversation = async () => {
            if (!selectedConversationId) {
                setSelectedConversation(null);
                return;
            }

            try {
                setConversationLoading(true);
                const conversation = await api.getConversation(selectedConversationId);
                setSelectedConversation(conversation);

                const firstUserMessage = conversation.messages.find(isUserMessage);
                setSelectedTimestamp(firstUserMessage?.timestamp || null);
            } catch (err) {
                console.error(err);
                setError("Impossible de charger cette conversation");
            } finally {
                setConversationLoading(false);
            }
        };

        loadConversation();
    }, [selectedConversationId]);

    const selectedMessage: ConversationMessage | undefined = useMemo(() => {
        if (!selectedConversation || !selectedTimestamp) return undefined;
        return selectedConversation.messages.find(
            (msg) => msg.timestamp === selectedTimestamp && isUserMessage(msg)
        );
    }, [selectedConversation, selectedTimestamp]);

    const selectedAnalysis: MessageAnalysis | undefined = useMemo(() => {
        if (!selectedConversation || !selectedTimestamp) return undefined;
        return selectedConversation.analysis?.messageAnalyses.find(
            (entry) => entry.messageTimestamp === selectedTimestamp
        );
    }, [selectedConversation, selectedTimestamp]);

    const messagesWithIndex = useMemo(() => {
        if (!selectedConversation) return [];
        return selectedConversation.messages.map((msg, idx) => ({ ...msg, idx }));
    }, [selectedConversation]);

    const handleDeleteEmpty = async () => {
        try {
            setError(null);
            setCleanupLoading(true);
            await api.deleteEmptyConversations();
            await loadList();
        } catch (err) {
            console.error(err);
            setError("Impossible de supprimer les conversations vides");
        } finally {
            setCleanupLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedConversation || !selectedTimestamp) return;
        if (!apiKey) {
            setError("Merci de renseigner votre clé API OpenAI");
            return;
        }

        try {
            setError(null);
            setAnalysisLoading(true);
            localStorage.setItem("openai_api_key", apiKey);

            const analysis = await api.analyzeMessage(
                selectedConversation.id,
                selectedTimestamp,
                apiKey
            );

            setSelectedConversation((prev) => {
                if (!prev) return prev;
                const existing = prev.analysis?.messageAnalyses || [];
                const filtered = existing.filter((item) => item.messageTimestamp !== selectedTimestamp);
                return {
                    ...prev,
                    analysis: {
                        messageAnalyses: [...filtered, analysis],
                        lastAnalyzedAt: Date.now(),
                    },
                };
            });
        } catch (err) {
            console.error(err);
            setError("Analyse indisponible. Vérifiez votre clé API et réessayez.");
        } finally {
            setAnalysisLoading(false);
        }
    };

    const themeTitle = selectedConversation
        ? themesById[selectedConversation.themeId]?.title || "Thème inconnu"
        : "";

    const handleDeleteConversation = async () => {
        if (!selectedConversationId) return;
        const confirmed = window.confirm("Supprimer cette conversation ?");
        if (!confirmed) return;

        try {
            setError(null);
            setDeleteLoading(true);
            await api.deleteConversation(selectedConversationId);
            await loadList();
        } catch (err) {
            console.error(err);
            setError("Impossible de supprimer la conversation");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="conversation-manager">
            <div className="manager-header">
                <div>
                    <p className="eyebrow">Analyse de vos échanges</p>
                    <h2>Conversations enregistrées</h2>
                    <p className="subtitle">
                        Sélectionnez un échange, choisissez une réponse utilisateur, puis demandez une analyse ciblée.
                    </p>
                </div>
                <div className="api-key-block">
                    <label htmlFor="analysis-api-key">Clé API OpenAI</label>
                    <input
                        id="analysis-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                    />
                    <span className="hint">La clé n'est jamais stockée côté serveur.</span>
                </div>
            </div>

            <div className="manager-grid">
                <section className="conversation-list">
                    <div className="section-header">
                        <div className="title-group">
                            <h3>Conversations</h3>
                            <span className="badge">{conversations.length}</span>
                        </div>
                        <div className="header-actions">
                            <button
                                className="ghost-button"
                                onClick={handleDeleteEmpty}
                                disabled={cleanupLoading || listLoading}
                            >
                                {cleanupLoading ? "Nettoyage..." : "Supprimer les vides"}
                            </button>
                        </div>
                    </div>

                    {listLoading && <div className="panel muted">Chargement...</div>}
                    {!listLoading && conversations.length === 0 && (
                        <div className="panel muted">Aucune conversation enregistrée pour l'instant.</div>
                    )}

                    {!listLoading && conversations.length > 0 && (
                        <ul className="conversation-items">
                            {conversations.map((conv) => (
                                <li
                                    key={conv.id}
                                    className={`conversation-item ${conv.id === selectedConversationId ? "active" : ""
                                        }`}
                                    onClick={() => setSelectedConversationId(conv.id)}
                                >
                                    <div className="item-top">
                                        <span className="theme">{conv.themeTitle}</span>
                                        <span className={`status ${conv.endTime ? "done" : "live"}`}>
                                            {conv.endTime ? "Terminé" : "En cours"}
                                        </span>
                                    </div>
                                    <div className="item-meta">
                                        <span>{formatDate(conv.startTime)}</span>
                                        <span>{conv.messageCount} messages</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="conversation-detail">
                    {conversationLoading && <div className="panel muted">Chargement de la conversation...</div>}

                    {!conversationLoading && !selectedConversation && (
                        <div className="panel muted">Choisissez une conversation pour afficher le détail.</div>
                    )}

                    {!conversationLoading && selectedConversation && (
                        <div className="detail-content">
                            <header className="detail-header">
                                <div>
                                    <p className="eyebrow">{themeTitle}</p>
                                    <h3>Journal de la conversation</h3>
                                    <p className="subtitle">
                                        Cliquez sur une réponse utilisateur pour la soumettre à l'analyse.
                                    </p>
                                </div>
                                <div className="detail-actions">
                                    <div className="timestamp">
                                        Début {formatDate(selectedConversation.startTime)}
                                        {selectedConversation.endTime && (
                                            <>
                                                <br />Fin {formatDate(selectedConversation.endTime)}
                                            </>
                                        )}
                                    </div>
                                    <button
                                        className="danger-button"
                                        onClick={handleDeleteConversation}
                                        disabled={deleteLoading}
                                    >
                                        {deleteLoading ? "Suppression..." : "Supprimer"}
                                    </button>
                                </div>
                            </header>

                            <div className="messages">
                                {messagesWithIndex.length === 0 && (
                                    <div className="panel muted">Aucun message enregistré.</div>
                                )}

                                {messagesWithIndex.length > 0 && (
                                    <div className="message-list">
                                        {messagesWithIndex.map((msg) => {
                                            const isSelected = msg.timestamp === selectedTimestamp && isUserMessage(msg);
                                            return (
                                                <div
                                                    key={`${msg.timestamp}-${msg.idx}`}
                                                    className={`message-row ${msg.role} ${isSelected ? "selected" : ""}`}
                                                    onClick={() => isUserMessage(msg) && setSelectedTimestamp(msg.timestamp)}
                                                >
                                                    <div className="message-meta">
                                                        <span className="role">{msg.role === "user" ? "Vous" : "Agent"}</span>
                                                        <span className="time">{formatDate(msg.timestamp)}</span>
                                                    </div>
                                                    <p className="message-content">{msg.content}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="analysis-panel">
                                <div className="section-header">
                                    <h4>Analyse ciblée</h4>
                                    {selectedAnalysis && (
                                        <span className="badge subtle">
                                            Mis à jour {formatDate(selectedAnalysis.analyzedAt)}
                                        </span>
                                    )}
                                </div>

                                {!selectedMessage && (
                                    <div className="panel muted">Sélectionnez une réponse utilisateur pour lancer l'analyse.</div>
                                )}

                                {selectedMessage && (
                                    <div className="analysis-body">
                                        <div className="analysis-target">
                                            <p className="label">Réponse sélectionnée</p>
                                            <p className="quote">{selectedMessage.content}</p>
                                            <button
                                                className="cta"
                                                onClick={handleAnalyze}
                                                disabled={analysisLoading}
                                            >
                                                {analysisLoading ? "Analyse en cours..." : "Lancer l'analyse"}
                                            </button>
                                        </div>

                                        {selectedAnalysis ? (
                                            <div className="analysis-result">
                                                <p className="label">Synthèse</p>
                                                <p className="summary">{selectedAnalysis.summary || "Pas de synthèse disponible."}</p>

                                                {selectedAnalysis.improvedExample && (
                                                    <div className="improvement">
                                                        <p className="label">Version améliorée (optionnelle)</p>
                                                        <p className="quote alt">{selectedAnalysis.improvedExample}</p>
                                                    </div>
                                                )}

                                                <div className="issues">
                                                    {selectedAnalysis.issues.length === 0 && (
                                                        <div className="panel muted">Aucune amélioration détectée.</div>
                                                    )}

                                                    {selectedAnalysis.issues.length > 0 && (
                                                        <ul>
                                                            {selectedAnalysis.issues.map((issue, idx) => (
                                                                <li key={idx} className={`issue ${issue.severity}`}>
                                                                    <div className="issue-header">
                                                                        <span className="pill">{issue.category}</span>
                                                                        <span className={`severity ${issue.severity}`}>{issue.severity}</span>
                                                                    </div>
                                                                    <p className="issue-text">{issue.description}</p>
                                                                    <p className="issue-suggestion">Suggestion : {issue.suggestion}</p>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="panel muted">Aucune analyse effectuée pour cette réponse.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}
        </div>
    );
}
