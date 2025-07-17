import { useMutation, useQuery } from '@tanstack/react-query';
import {
  postAutomationStatus,
  postContentPublished,
  postEngagementUpdate,
  fetchAnalyticsData,
} from '../services/webhooks';

export const useAutomationStatus = () =>
  useMutation({ mutationFn: postAutomationStatus });

export const useContentPublished = () =>
  useMutation({ mutationFn: postContentPublished });

export const useEngagementUpdate = () =>
  useMutation({ mutationFn: postEngagementUpdate });

export const useAnalyticsData = () =>
  useQuery({ queryKey: ['analytics-data'], queryFn: fetchAnalyticsData }); 