import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/constants/theme';

interface SelectionBottomSheetProps {
  title: string;
  data: any[];
  onSelect: (item: any) => void;
  selectedId?: string | number;
  keyExtractor?: (item: any) => string;
  labelExtractor?: (item: any) => string;
  isLoading?: boolean;
  loading?: boolean;
  onDismiss?: () => void;
  showSearch?: boolean;
}

const SelectionBottomSheet = forwardRef<BottomSheetModal, SelectionBottomSheetProps>(
  ({ title, data, onSelect, selectedId, keyExtractor, labelExtractor, isLoading, loading, onDismiss, showSearch = false }, ref) => {
    const [searchQuery, setSearchQuery] = useState('');
    const snapPoints = useMemo(() => ['50%', '85%'], []);
    const insets = useSafeAreaInsets();
    const { colors } = useAppTheme();

    const isDataLoading = isLoading || loading;

    const getItemLabel = (item: any): string => {
      if (labelExtractor) return labelExtractor(item);
      if (item.name) return item.name;
      if (item.class_name) return `Class ${item.class_name}`;
      if (item.section_name) return `Section ${item.section_name}`;
      return String(item.id || '');
    };

    const getItemKey = (item: any, index: number): string => {
      if (keyExtractor) return keyExtractor(item);
      return String(item.id || index);
    };

    const filteredData = useMemo(() => {
      if (!searchQuery) return data;
      return data.filter((item) => {
        const label = getItemLabel(item);
        return label.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }, [data, searchQuery]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      []
    );

    const handleSelect = (item: any) => {
      onSelect(item);
      (ref as any).current?.dismiss();
    };

    const renderItem = ({ item }: { item: any }) => {
      const label = getItemLabel(item);
      const itemId = item.id;
      const isSelected = selectedId !== undefined && String(selectedId) === String(itemId);

      return (
        <TouchableOpacity 
          style={[styles.item, { borderBottomColor: colors.border }]} 
          onPress={() => handleSelect(item)}
        >
          <Text style={[
            styles.itemText, 
            { color: colors.text },
            isSelected && { color: colors.primary, fontWeight: '700' }
          ]}>{label}</Text>
          {isSelected ? (
            <Ionicons name="checkmark" size={20} color={colors.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      );
    };

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.border }]}
        onDismiss={() => {
          setSearchQuery('');
          onDismiss?.();
        }}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          
          {showSearch && (
            <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
              <BottomSheetTextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isDataLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading data...</Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={filteredData}
              keyExtractor={getItemKey}
              renderItem={renderItem}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No results found</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  handleIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 15,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 15,
    height: 45,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
});

export default SelectionBottomSheet;
