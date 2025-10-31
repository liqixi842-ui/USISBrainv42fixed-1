import type { InsertDecision, Decision } from "@shared/schema";

export interface IStorage {
  createDecision(decision: InsertDecision): Promise<Decision>;
  getAllDecisions(): Promise<Decision[]>;
  getDecisionById(id: number): Promise<Decision | null>;
}

export class MemStorage implements IStorage {
  private decisions: Decision[] = [];
  private nextId = 1;

  async createDecision(decision: InsertDecision): Promise<Decision> {
    const newDecision: Decision = {
      id: this.nextId++,
      ...decision,
      createdAt: new Date(),
    };
    this.decisions.push(newDecision);
    return newDecision;
  }

  async getAllDecisions(): Promise<Decision[]> {
    return [...this.decisions].reverse();
  }

  async getDecisionById(id: number): Promise<Decision | null> {
    return this.decisions.find(d => d.id === id) || null;
  }
}

export const storage = new MemStorage();
