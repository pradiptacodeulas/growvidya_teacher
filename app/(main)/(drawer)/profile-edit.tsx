import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import InternalHeader from "@/components/InternalHeader";
import apiClient from "@/services/apiClient";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { updateProfile, fetchProfile } from "@/redux/features/auth/thunks";
import { useAppTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Toast from "react-native-toast-message";

export default function ProfileEditScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors, isDark } = useAppTheme();
  const [isSaving, setIsSaving] = useState(false);

  // Address logic: current address (index 0), permanent address (index 1)
  const currentAddress = Array.isArray(user?.address) ? user?.address?.[0] : null;
  const permanentAddress = Array.isArray(user?.address) ? user?.address?.[1] : null;

  // same_permanent is inside the address object in the backend response
  const isSameAsPermanent =
    currentAddress?.same_permanent !== undefined
      ? Number(currentAddress?.same_permanent) === 1
      : true;

  const [formData, setFormData] = useState({
    first_name: user?.first_name || user?.firstName || "",
    last_name: user?.last_name || user?.lastName || "",
    gender: user?.gender || "",
    gender_name: user?.gender_name || "",
    date_of_birth: (user?.date_of_birth || user?.dateOfBirth || user?.dob || "")?.split(" ")[0] || "",
    marital_status: user?.marital_status || user?.maritalStatus || "",
    pan_number: user?.pan_number || "",
    blood_group: user?.blood_group_name || user?.bloodGroupName || user?.blood_group || user?.bloodGroup || "",
    email: user?.email || user?.email_address || "",
    phone: user?.phone || user?.primary_contact_number || "",
    father_name: user?.father_name || "",
    mother_name: user?.mother_name || "",
    employee_id: user?.teacherId || user?.teacher_id || user?.id || "",
    qualification: user?.qualification || "",
    date_of_joining: (user?.date_of_joining || user?.dateOfJoining || user?.joining_date || "")?.split(" ")[0] || "",
    work_experience: user?.work_experience || user?.workExperience || "",
    language_known: user?.language_known || "",

    same_permanent: isSameAsPermanent ? 1 : 0,

    current_address_1: currentAddress?.address1 || user?.address1 || (typeof user?.address === 'string' ? user?.address : "") || "",
    current_address_2: currentAddress?.address2 || user?.address2 || "",
    current_country_name: currentAddress?.country_name || user?.country_name || user?.countryName || "",
    current_state_name: currentAddress?.state_name || user?.state_name || user?.stateName || "",
    current_city_name: currentAddress?.city_name || user?.city_name || user?.cityName || "",
    current_postal_code: currentAddress?.postal_code || user?.postal_code || user?.postalCode || "",
    current_country: currentAddress?.country || user?.country || "",
    current_state: currentAddress?.state || user?.state || "",
    current_city: currentAddress?.city || user?.city || "",

    permanent_address_1:
      (isSameAsPermanent
        ? currentAddress?.address1 || user?.address1
        : permanentAddress?.address1) || "",
    permanent_address_2:
      (isSameAsPermanent
        ? currentAddress?.address2 || user?.address2
        : permanentAddress?.address2) || "",
    permanent_country_name:
      (isSameAsPermanent
        ? currentAddress?.country_name || user?.country_name || user?.countryName
        : permanentAddress?.country_name) || "",
    permanent_state_name:
      (isSameAsPermanent
        ? currentAddress?.state_name || user?.state_name || user?.stateName
        : permanentAddress?.state_name) || "",
    permanent_city_name:
      (isSameAsPermanent
        ? currentAddress?.city_name || user?.city_name || user?.cityName
        : permanentAddress?.city_name) || "",
    permanent_postal_code:
      (isSameAsPermanent
        ? currentAddress?.postal_code || user?.postal_code || user?.postalCode
        : permanentAddress?.postal_code) || "",
    permanent_country:
      (isSameAsPermanent
        ? currentAddress?.country || user?.country
        : permanentAddress?.country) || "",
    permanent_state:
      (isSameAsPermanent
        ? currentAddress?.state || user?.state
        : permanentAddress?.state) || "",
    permanent_city:
      (isSameAsPermanent
        ? currentAddress?.city || user?.city
        : permanentAddress?.city) || "",
  });

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f8f9fa",
        }}
      >
        <ActivityIndicator size="large" color="#3d5ee1" />
      </View>
    );
  }

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [modalType, setModalType] = useState<
    "gender" | "marital" | "country" | "state" | "city" | null
  >(null);
  const [activeAddressType, setActiveAddressType] = useState<
    "current" | "permanent"
  >("current");

  const genderOptions = [
    { id: 1, name: "Male" },
    { id: 2, name: "Female" },
    { id: 3, name: "Others" },
  ];

  const maritalOptions = [
    { id: 1, name: "Single" },
    { id: 2, name: "Married" },
    { id: 3, name: "Divorced" },
  ];

  useEffect(() => {
    fetchCountries();
  }, []);

  const normalizeData = (rawData: any, type: "country" | "state" | "city") => {
    const data = rawData || [];
    return data.map((item: any) => {
      switch (type) {
        case "country":
          return {
            id: item.id || item.id_country,
            name: item.name || item.country,
          };
        case "state":
          return {
            id: item.id_state || item.id,
            name: item.state || item.name,
          };
        case "city":
          return { id: item.id_city || item.id, name: item.city || item.name };
        default:
          return { id: item.id, name: item.name };
      }
    });
  };

  const fetchCountries = async () => {
    try {
      const res = await apiClient.get('/admin/academics/countries');
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setCountries(normalizeData(list, "country"));
      }
    } catch (e) {
      console.error("Fetch Countries Error:", e);
    }
  };

  const fetchStates = async (countryId: string) => {
    setModalLoading(true);
    try {
      const res = await apiClient.get('/admin/academics/states', {
        params: { country_id: countryId },
      });
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setStates(normalizeData(list, "state"));
      }
    } catch (e) {
      console.error("Fetch States Error:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const fetchCities = async (stateId: string) => {
    setModalLoading(true);
    try {
      const res = await apiClient.get('/admin/academics/cities', {
        params: { state_id: stateId },
      });
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setCities(normalizeData(list, "city"));
      }
    } catch (e) {
      console.error("Fetch Cities Error:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && event?.type !== 'dismissed') {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      setFormData({ ...formData, date_of_birth: formattedDate });
    }
  };

  const openBottomSheet = (
    type: any,
    addressType?: "current" | "permanent",
  ) => {
    setModalType(type);
    if (addressType) setActiveAddressType(addressType);

    if (type === "state") {
      const countryId =
        addressType === "current"
          ? formData.current_country
          : formData.permanent_country;
      if (!countryId) {
        Toast.show({
          type: "info",
          text1: "Info",
          text2: "Please select a country first",
        });
        return;
      }
      fetchStates(countryId.toString());
    }

    if (type === "city") {
      const stateId =
        addressType === "current"
          ? formData.current_state
          : formData.permanent_state;
      if (!stateId) {
        Toast.show({
          type: "info",
          text1: "Info",
          text2: "Please select a state first",
        });
        return;
      }
      fetchCities(stateId.toString());
    }

    bottomSheetModalRef.current?.present();
  };

  const handleSelect = (item: any) => {
    if (modalType === "gender") {
      setFormData({ ...formData, gender: item.id });
    } else if (modalType === "marital") {
      setFormData({ ...formData, marital_status: item.id });
    } else if (modalType === "country") {
      if (activeAddressType === "current") {
        setFormData({
          ...formData,
          current_country_name: item.name,
          current_country: item.id,
          current_state: "",
          current_city: "",
          current_state_name: "",
          current_city_name: "",
        });
      } else {
        setFormData({
          ...formData,
          permanent_country_name: item.name,
          permanent_country: item.id,
          permanent_state: "",
          permanent_city: "",
          permanent_state_name: "",
          permanent_city_name: "",
        });
      }
    } else if (modalType === "state") {
      if (activeAddressType === "current") {
        setFormData({
          ...formData,
          current_state_name: item.name,
          current_state: item.id,
          current_city: "",
          current_city_name: "",
        });
      } else {
        setFormData({
          ...formData,
          permanent_state_name: item.name,
          permanent_state: item.id,
          permanent_city: "",
          permanent_city_name: "",
        });
      }
    } else if (modalType === "city") {
      if (activeAddressType === "current") {
        setFormData({
          ...formData,
          current_city_name: item.name,
          current_city: item.id,
        });
      } else {
        setFormData({
          ...formData,
          permanent_city_name: item.name,
          permanent_city: item.id,
        });
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Construct the payload
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      gender:
        genderOptions.find((g) => g.id === Number(formData.gender))?.id ||
        formData.gender,
      marital_status:
        maritalOptions.find((m) => m.id === Number(formData.marital_status))
          ?.id || formData.marital_status,
      date_of_birth: formData.date_of_birth ? formData.date_of_birth.split(" ")[0] : null,
      current_address_1: formData.current_address_1,
      current_address_2: formData.current_address_2,
      current_country: formData.current_country || null,
      current_state: formData.current_state || null,
      current_city: formData.current_city || null,
      current_postal_code: formData.current_postal_code || null,
      same_permanent: formData.same_permanent === 1 ? 1 : 0,
      parmanent_address_1:
        formData.same_permanent === 1
          ? formData.current_address_1
          : formData.permanent_address_1,
      parmanent_address_2:
        formData.same_permanent === 1
          ? formData.current_address_2
          : formData.permanent_address_2,
      parmanent_country:
        formData.same_permanent === 1
          ? formData.current_country || null
          : formData.permanent_country || null,
      parmanent_state:
        formData.same_permanent === 1
          ? formData.current_state || null
          : formData.permanent_state || null,
      parmanent_city:
        formData.same_permanent === 1
          ? formData.current_city || null
          : formData.permanent_city || null,
      parmanent_postal_code:
        formData.same_permanent === 1
          ? formData.current_postal_code || null
          : formData.permanent_postal_code || null,
    };

    try {
      const resultAction = await dispatch(updateProfile(payload));
      if (updateProfile.fulfilled.match(resultAction)) {
        await dispatch(fetchProfile());
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Profile updated successfully.",
        });
        router.back();
      } else {
        const error = resultAction.payload as string;
        throw new Error(error || "Failed to update profile");
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: error.message || "Something went wrong.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    icon: string,
    keyboardType: any = "default",
    placeholder?: string,
    editable: boolean = true,
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, !editable && { backgroundColor: colors.surfaceSubtle }]}>
        <Ionicons
          name={icon as any}
          size={20}
          color={editable ? colors.textMuted : colors.border}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, { color: colors.text }, !editable && { color: colors.textMuted }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          editable={editable}
        />
      </View>
    </View>
  );

  const renderDropdown = (
    label: string,
    value: string,
    onPress: () => void,
    icon: string,
    enabled: boolean = true,
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, !enabled && { backgroundColor: colors.surfaceSubtle }]}
        onPress={enabled ? onPress : undefined}
        activeOpacity={enabled ? 0.7 : 1}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={enabled ? colors.textMuted : colors.border}
          style={styles.inputIcon}
        />
        <Text
          style={[
            styles.input,
            {
              lineHeight: 45,
              color: enabled ? (value ? colors.text : colors.textMuted) : colors.textMuted,
            },
          ]}
        >
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        {enabled && <Ionicons name="chevron-down" size={18} color={colors.textMuted} />}
      </TouchableOpacity>
    </View>
  );

  const getModalData = () => {
    if (modalType === "gender") return genderOptions;
    if (modalType === "marital") return maritalOptions;
    if (modalType === "country") return countries;
    if (modalType === "state") return states;
    if (modalType === "city") return cities;
    return [];
  };

  const getModalTitle = () => {
    if (modalType === "gender") return "Select Gender";
    if (modalType === "marital") return "Select Marital Status";
    if (modalType === "country") return "Select Country";
    if (modalType === "state") return "Select State";
    if (modalType === "city") return "Select City";
    return "";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Edit Profile" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderInput(
                  "First Name",
                  formData.first_name,
                  (text) => setFormData({ ...formData, first_name: text }),
                  "person-outline",
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Last Name",
                  formData.last_name,
                  (text) => setFormData({ ...formData, last_name: text }),
                  "person-outline",
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderDropdown(
                  "Gender",
                  genderOptions.find((g) => g.id === Number(formData.gender))
                    ?.name || formData.gender_name,
                  () => openBottomSheet("gender"),
                  "transgender-outline",
                  true,
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderDropdown(
                  "Marital Status",
                  maritalOptions.find(
                    (m) => m.id === Number(formData.marital_status),
                  )?.name || formData.marital_status.toString(),
                  () => openBottomSheet("marital"),
                  "heart-outline",
                  true,
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderDropdown(
                  "Date of Birth",
                  formData.date_of_birth ? formData.date_of_birth.split(" ")[0] : "",
                  () => setShowDatePicker(true),
                  "calendar-outline",
                  true,
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Blood Group",
                  String(formData.blood_group || ""),
                  () => {},
                  "water-outline",
                  "default",
                  undefined,
                  false,
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderInput(
                  "Email",
                  formData.email,
                  () => {},
                  "mail-outline",
                  "email-address",
                  undefined,
                  false,
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Phone",
                  formData.phone,
                  () => {},
                  "call-outline",
                  "phone-pad",
                  undefined,
                  false,
                )}
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={
                  formData.date_of_birth
                    ? new Date(formData.date_of_birth)
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Family Details</Text>
            {renderInput(
              "Father's Name",
              formData.father_name,
              () => {},
              "man-outline",
              "default",
              undefined,
              false,
            )}
            {renderInput(
              "Mother's Name",
              formData.mother_name,
              () => {},
              "woman-outline",
              "default",
              undefined,
              false,
            )}
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Professional Details</Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderInput(
                  "Employee ID",
                  String(formData.employee_id || ""),
                  () => {},
                  "id-card-outline",
                  "default",
                  undefined,
                  false,
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Qualification",
                  formData.qualification,
                  () => {},
                  "school-outline",
                  "default",
                  undefined,
                  false,
                )}
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderInput(
                  "Joining Date",
                  formData.date_of_joining,
                  () => {},
                  "calendar-outline",
                  "default",
                  undefined,
                  false,
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Work Experience",
                  formData.work_experience,
                  () => {},
                  "time-outline",
                  "default",
                  undefined,
                  false,
                )}
              </View>
            </View>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Identity & Others</Text>
            {renderInput(
              "PAN Number",
              formData.pan_number,
              (text) => setFormData({ ...formData, pan_number: text }),
              "card-outline",
              "default",
              undefined,
              false,
            )}
            {renderInput(
              "Languages Known",
              formData.language_known,
              () => {},
              "language-outline",
              "default",
              undefined,
              false,
            )}
          </View>

          {/* Current Address Section - FIRST */}
          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {formData.same_permanent === 1 ? "Address" : "Current Address"}
            </Text>

            {renderInput(
              "Address Line 1",
              formData.current_address_1,
              (text) => setFormData({ ...formData, current_address_1: text }),
              "map-outline",
            )}
            {renderInput(
              "Address Line 2",
              formData.current_address_2,
              (text) => setFormData({ ...formData, current_address_2: text }),
              "map-outline",
            )}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderDropdown(
                  "Country",
                  formData.current_country_name,
                  () => openBottomSheet("country", "current"),
                  "globe-outline",
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderDropdown(
                  "State",
                  formData.current_state_name,
                  () => openBottomSheet("state", "current"),
                  "location-outline",
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                {renderDropdown(
                  "City",
                  formData.current_city_name,
                  () => openBottomSheet("city", "current"),
                  "business-outline",
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput(
                  "Postal Code",
                  formData.current_postal_code,
                  (text) =>
                    setFormData({ ...formData, current_postal_code: text }),
                  "pin-outline",
                  "number-pad",
                )}
              </View>
            </View>
          </View>

          {/* Switch for same address logic */}
          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                Permanent address is same as current
              </Text>
              <Switch
                value={formData.same_permanent === 1}
                onValueChange={(value) =>
                  setFormData({ ...formData, same_permanent: value ? 1 : 0 })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={formData.same_permanent === 1 ? "#FFFFFF" : colors.textMuted}
              />
            </View>
          </View>

          {/* Permanent Address Section - ONLY if same_permanent is 0 (Different) */}
          {formData.same_permanent === 0 && (
            <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Permanent Address</Text>

              {renderInput(
                "Address Line 1",
                formData.permanent_address_1,
                (text) =>
                  setFormData({ ...formData, permanent_address_1: text }),
                "map-outline",
              )}
              {renderInput(
                "Address Line 2",
                formData.permanent_address_2,
                (text) =>
                  setFormData({ ...formData, permanent_address_2: text }),
                "map-outline",
              )}

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  {renderDropdown(
                    "Country",
                    formData.permanent_country_name,
                    () => openBottomSheet("country", "permanent"),
                    "globe-outline",
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {renderDropdown(
                    "State",
                    formData.permanent_state_name,
                    () => openBottomSheet("state", "permanent"),
                    "location-outline",
                  )}
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  {renderDropdown(
                    "City",
                    formData.permanent_city_name,
                    () => openBottomSheet("city", "permanent"),
                    "business-outline",
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {renderInput(
                    "Postal Code",
                    formData.permanent_postal_code,
                    (text) =>
                      setFormData({ ...formData, permanent_postal_code: text }),
                    "pin-outline",
                    "number-pad",
                  )}
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              isSaving && styles.disabledButton,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectionBottomSheet
        ref={bottomSheetModalRef}
        title={getModalTitle()}
        data={getModalData()}
        onSelect={handleSelect}
        loading={modalLoading}
        showSearch={modalType ? ["country", "state", "city"].includes(modalType) : false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    height: 48,
  },
  disabledInput: {
    opacity: 0.8,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 45,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  saveButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
