import OpenAI from "openai";
import { DataService } from "./data.service";
import {
    AnalysisIssue,
    AnalysisSeverity,
    Conversation,
    MessageAnalysis,
} from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

function formatConversationContext(conversation: Conversation, limit = 8): string {
    const recent = conversation.messages.slice(-limit);
    return recent
        .map((msg, idx) => `${idx + 1}. ${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");
}

function normalizeIssue(issue: Partial<AnalysisIssue>): AnalysisIssue {
    const severity: AnalysisSeverity =
        issue.severity === "high" || issue.severity === "medium" || issue.severity === "low"
            ? issue.severity
            : "medium";

    const category =
        issue.category === "grammar" ||
            issue.category === "spelling" ||
            issue.category === "wording" ||
            issue.category === "clarity" ||
            issue.category === "tone" ||
            issue.category === "structure" ||
            issue.category === "consistency" ||
            issue.category === "other"
            ? issue.category
            : "other";

    return {
        category,
        severity,
        description: issue.description || "",
        suggestion: issue.suggestion || "",
    };
}

export class AnalysisService {
    static async analyzeUserMessage(
        conversationId: string,
        messageTimestamp: number,
        apiKey: string
    ): Promise<MessageAnalysis> {
        const conversation = DataService.getConversationById(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        const theme = DataService.getThemeById(conversation.themeId);
        const userMessage = conversation.messages.find(
            (msg) => msg.timestamp === messageTimestamp && msg.role === "user"
        );

        if (!userMessage) {
            throw new Error("User message not found for analysis");
        }

        const client = new OpenAI({ apiKey });

        const context = formatConversationContext(conversation);

        const prompt = `Tu es un coach d'entretien francophone.\n` +
            `Analyse la réponse de l'utilisateur pour détecter les fautes simples (grammaire, orthographe), les choix de mots maladroits, et les passages peu clairs.\n` +
            `Reste concis et donne des suggestions faciles à appliquer. Ne réécris pas entièrement la réponse.\n` +
            `Conversation: ${theme ? theme.title : "(thème inconnu)"}\n` +
            `${theme ? `Description: ${theme.description}\n` : ""}` +
            `Contexte (ordre chronologique, max ${Math.min(
                conversation.messages.length,
                8
            )} derniers messages):\n${context}\n` +
            `Réponse à analyser: "${userMessage.content}"`;

        const completion = await client.chat.completions.create({
            model: DEFAULT_MODEL,
            temperature: 0.35,
            max_tokens: 400,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content:
                        "Retourne uniquement du JSON. Les textes doivent rester en français. Les suggestions doivent être actionnables et courtes.",
                },
                {
                    role: "user",
                    content: `${prompt}\nSchema attendu: {\"summary\": string, \"issues\": [{\"category\": string, \"severity\": \"low\"|\"medium\"|\"high\", \"description\": string, \"suggestion\": string}], \"improvedExample\": string?}`,
                },
            ],
        });

        const content = completion.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            parsed = {};
        }

        const issues: AnalysisIssue[] = Array.isArray(parsed.issues)
            ? parsed.issues.map((issue: Partial<AnalysisIssue>) => normalizeIssue(issue))
            : [];

        const analysis: MessageAnalysis = {
            messageTimestamp,
            summary: parsed.summary || "",
            issues,
            improvedExample: parsed.improvedExample,
            analyzedAt: Date.now(),
        };

        const existing = conversation.analysis?.messageAnalyses || [];
        const filtered = existing.filter((m) => m.messageTimestamp !== messageTimestamp);
        const updatedAnalysis = {
            messageAnalyses: [...filtered, analysis],
            lastAnalyzedAt: Date.now(),
        };

        conversation.analysis = updatedAnalysis;
        DataService.saveConversation(conversation);

        return analysis;
    }
}
