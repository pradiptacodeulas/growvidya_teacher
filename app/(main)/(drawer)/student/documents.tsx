import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, BackHandler, ActivityIndicator, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient, getFileUrl } from '@/services/apiClient';

export default function StudentDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleBack = () => {
    router.navigate({
      pathname: '/(main)/(drawer)/student/[id]',
      params: { id }
    });
  };

  useEffect(() => {
    const handleHardwareBack = () => {
      handleBack();
      return true; // prevent default back behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => {
      subscription.remove();
    };
  }, [router, id]);

  const loadDocuments = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await apiClient.get(`/admin/students/${id}`);
      const st = res.data?.data?.student || res.data?.student || res.data?.data || res.data;
      if (st && Array.isArray(st.documents)) {
        setDocuments(st.documents);
      } else {
        setDocuments([]);
      }
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadDocuments();
  }, [id, loadDocuments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDocuments(true);
  }, [loadDocuments]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Documents" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InternalHeader title="Documents" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          {documents.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={48} color="#7a869a" />
              </View>
              <Text style={styles.emptyStateTitle}>No Documents Uploaded</Text>
              <Text style={styles.emptyStateSubtitle}>
                No files or digital documents have been uploaded for this student.
              </Text>
            </View>
          ) : (
            documents.map((doc: any, index: number) => (
              <View key={doc.id || index} style={styles.card}>
                <View style={styles.docRow}>
                  <Ionicons name="document-outline" size={28} color="#3d5ee1" />
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{doc.title || doc.document_name || `Document ${index + 1}`}</Text>
                    <Text style={styles.docSubtitle}>{doc.category_name || doc.document_type || 'General'}</Text>
                  </View>
                  {doc.file_path && (
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(getFileUrl(doc.file_path))}
                      style={styles.downloadBtn}
                    >
                      <Ionicons name="download-outline" size={20} color="#3d5ee1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  errorText: { color: '#7a869a', fontSize: 15 },
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202c4b',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#7a869a',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: 12,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202c4b',
  },
  docSubtitle: {
    fontSize: 12,
    color: '#7a869a',
    marginTop: 2,
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
