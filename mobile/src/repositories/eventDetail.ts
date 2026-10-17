import AsyncStorage from "@react-native-async-storage/async-storage";
import { mockEvents } from "../constants/mockEvents";
import { createMockEventDetailRepository } from "./eventDetailRepository";

// Auth導入までは固定のモック参加者。認証済みユーザーと取り違えないこと。
export const eventDetailRepository = createMockEventDetailRepository(AsyncStorage, mockEvents, "mock-participant");
