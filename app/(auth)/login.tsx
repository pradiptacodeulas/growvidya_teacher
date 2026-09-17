import { useAppTheme } from "@/constants/theme";
import { loginFailure, loginStart, loginSuccess } from "@/redux/features/auth/slice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { apiClient, setAuthToken } from "@/services/apiClient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { isLoading } = useAppSelector((state) => state.auth);
  const { colors, isDark } = useAppTheme();

  // Authentication Mode: 'passcode' (default) or 'password' (fallback)
  const [authMethod, setAuthMethod] = useState<"passcode" | "password">("passcode");

  // Passcode flow step: 1 (Enter Identifier) or 2 (Enter 6-Digit Passcode)
  const [step, setStep] = useState<1 | 2>(1);

  // Common identifier: Teacher ID, Email address, or Phone number
  const [identifier, setIdentifier] = useState("");

  // Password-based authentication states
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Passcode-based authentication states
  const [passcode, setPasscode] = useState("");
  const [testPasscode, setTestPasscode] = useState<string | null>(null);
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [requestingPasscode, setRequestingPasscode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const passcodeInputRef = useRef<TextInput>(null);

  // Countdown timer for passcode resend cooldown
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Helper to normalize and save user session after successful login
  const handleSessionSuccess = (resData: any, defaultMessage: string) => {
    const rawTeacher = resData.data?.teacher || resData.data;
    const token = resData.data?.token || rawTeacher?.token;

    if (token) {
      setAuthToken(token);
    }

    const userData: any = {
      ...rawTeacher,
      id: String(rawTeacher?.id || rawTeacher?.teacherId || ""),
      school_id: String(rawTeacher?.schoolId || rawTeacher?.school_id || "1"),
      school_name: rawTeacher?.schoolName || rawTeacher?.school_name || "Growvidya School",
      first_name: rawTeacher?.firstName || rawTeacher?.first_name || "",
      last_name: rawTeacher?.lastName || rawTeacher?.last_name || "",
      name: rawTeacher?.name || `${rawTeacher?.firstName || rawTeacher?.first_name || ""} ${rawTeacher?.lastName || rawTeacher?.last_name || ""}`.trim(),
      email: rawTeacher?.email || rawTeacher?.email_address || identifier.trim(),
      phone: rawTeacher?.phone || rawTeacher?.primary_contact_number || "",
      picture: rawTeacher?.picture || "",
      gender: rawTeacher?.gender ?? 1,
      gender_name: rawTeacher?.gender_name || (rawTeacher?.gender === 2 ? "Female" : "Male"),
      date_of_birth: rawTeacher?.date_of_birth || rawTeacher?.dateOfBirth || rawTeacher?.dob || "",
      blood_group: rawTeacher?.blood_group || rawTeacher?.bloodGroup || "",
      blood_group_name: rawTeacher?.blood_group_name || rawTeacher?.bloodGroupName || "",
      marital_status: rawTeacher?.marital_status || rawTeacher?.maritalStatus || "",
      marital_status_name: rawTeacher?.marital_status_name || rawTeacher?.maritalStatusName || "",
      father_name: rawTeacher?.father_name || "",
      mother_name: rawTeacher?.mother_name || "",
      pan_number: rawTeacher?.pan_number || "",
      language_known: rawTeacher?.language_known || "",
      date_of_joining: rawTeacher?.date_of_joining || rawTeacher?.joining_date || "",
      qualification: rawTeacher?.qualification || "",
      work_experience: rawTeacher?.workExperience || rawTeacher?.work_experience || "",
      role_name: rawTeacher?.roleName || "Teacher",
      address: Array.isArray(rawTeacher?.address) ? rawTeacher.address : [],
      country: rawTeacher?.country || "",
      country_name: rawTeacher?.country_name || rawTeacher?.countryName || "",
      state: rawTeacher?.state || "",
      state_name: rawTeacher?.state_name || rawTeacher?.stateName || "",
      city: rawTeacher?.city || "",
      city_name: rawTeacher?.city_name || rawTeacher?.cityName || "",
      postal_code: rawTeacher?.postal_code || rawTeacher?.postalCode || "",
      token: token,
    };

    dispatch(loginSuccess(userData));
    Toast.show({
      type: "success",
      text1: "Welcome Back!",
      text2: resData.message || defaultMessage,
    });

    // Reset fields
    setPasscode("");
    setPassword("");
    setTestPasscode(null);
    setStep(1);

    router.replace("/(main)/(drawer)/(tabs)");
  };

  // Step 1: Request 6-digit passcode
  const handleRequestPasscode = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter your Teacher ID, Email, or Phone number.",
      });
      return;
    }

    setRequestingPasscode(true);
    try {
      const response = await apiClient.post<any>("/teacher/auth/request-passcode", {
        identifier: cleanId,
      });
      const resData = response.data?.data || response.data || {};

      setMaskedIdentifier(resData.maskedIdentifier || cleanId);
      if (resData.testPasscode) {
        setTestPasscode(String(resData.testPasscode));
      } else {
        setTestPasscode(null);
      }
      setPasscode("");
      setStep(2);
      setResendCooldown(30);
      Toast.show({
        type: "success",
        text1: "Passcode Generated",
        text2: "A 6-digit passcode has been generated successfully.",
      });

      // Focus passcode input on step 2 transition
      setTimeout(() => {
        passcodeInputRef.current?.focus();
      }, 300);
    } catch (err: any) {
      const errMsg =
        err.message || "Failed to generate passcode. Please check your credentials.";
      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: errMsg,
      });
    } finally {
      setRequestingPasscode(false);
    }
  };

  // Step 2: Verify 6-digit passcode & sign in
  const handleVerifyPasscode = async () => {
    const cleanCode = passcode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter the full 6-digit passcode.",
      });
      return;
    }

    dispatch(loginStart());
    try {
      const response = await apiClient.post<any>("/teacher/auth/verify-passcode", {
        identifier: identifier.trim(),
        passcode: cleanCode,
      });
      const resData = response.data;

      if (
        (resData.success === true || resData.status === true) &&
        resData.data
      ) {
        handleSessionSuccess(resData, "Signed in successfully via passcode.");
      } else {
        const errMsg =
          resData.message || "Passcode verification failed. Please try again.";
        dispatch(loginFailure(errMsg));
        Toast.show({
          type: "error",
          text1: "Verification Failed",
          text2: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg =
        err.message || "Invalid or expired 6-digit passcode. Please try again.";
      console.warn("Passcode verification error:", err);
      dispatch(loginFailure(errMsg));
      Toast.show({
        type: "error",
        text1: "Verification Failed",
        text2: errMsg,
      });
    }
  };

  // Password-based sign in fallback
  const handlePasswordLogin = async () => {
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill in both identifier and password fields.",
      });
      return;
    }

    dispatch(loginStart());
    try {
      const response = await apiClient.post<any>("/teacher/auth/login", {
        identifier: cleanId,
        email: cleanId,
        password: password,
      });
      const resData = response.data;

      if (
        (resData.success === true || resData.status === true) &&
        resData.data
      ) {
        handleSessionSuccess(resData, "Signed in successfully.");
      } else {
        const errMsg =
          resData.message || "Login failed. Please check your credentials.";
        dispatch(loginFailure(errMsg));
        Toast.show({
          type: "error",
          text1: "Login Failed",
          text2: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg = err.message || "An unexpected network error occurred.";
      console.warn("Password login error:", err);
      dispatch(loginFailure(errMsg));
      Toast.show({
        type: "error",
        text1: "Login Failed",
        text2: errMsg,
      });
    }
  };

  // Render 6-digit interactive passcode boxes
  const renderPasscodeBoxes = () => {
    const digits = passcode.split("");
    return (
      <TouchableOpacity
        style={styles.passcodeContainer}
        activeOpacity={1}
        onPress={() => passcodeInputRef.current?.focus()}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const digit = digits[index] || "";
          const isCurrent =
            passcode.length === index || (passcode.length === 6 && index === 5);
          return (
            <View
              key={index}
              style={[
                styles.digitBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: isCurrent
                    ? colors.primary
                    : digit
                      ? colors.primary
                      : colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.digitText,
                  { color: digit ? colors.text : colors.textMuted },
                ]}
              >
                {digit || "•"}
              </Text>
            </View>
          );
        })}

        {/* Hidden native input capturing numeric keyboard taps */}
        <TextInput
          ref={passcodeInputRef}
          style={styles.hiddenPasscodeInput}
          value={passcode}
          onChangeText={(text) =>
            setPasscode(text.replace(/[^0-9]/g, "").slice(0, 6))
          }
          keyboardType="number-pad"
          maxLength={6}
          autoFocus={step === 2}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.mainWrapper, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBarStyle} />

      <KeyboardAvoidingView
        style={[styles.keyboardView, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={[styles.scrollView, { backgroundColor: colors.background }]}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(insets.top + 16, 24),
                paddingBottom: Math.max(insets.bottom + 24, 32),
                backgroundColor: colors.background,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            bounces={false}
            overScrollMode="never"
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <Image
                source={
                  isDark
                    ? require("@/assets/images/logo_dark.png")
                    : require("@/assets/images/logo_light.png")
                }
                style={styles.logo}
                resizeMode="contain"
              />

              <View
                style={[
                  styles.portalBadge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons name="star" size={12} color={colors.primary} />
                <Text
                  style={[styles.portalBadgeText, { color: colors.primary }]}
                >
                  Teacher Portal
                </Text>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                Teacher Login
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {authMethod === "passcode"
                  ? step === 1
                    ? "Enter your Teacher ID, email, or phone to receive a 6-digit passcode."
                    : `Enter the 6-digit passcode sent to ${maskedIdentifier || identifier}.`
                  : "Enter your credentials to access your teacher dashboard."}
              </Text>
            </View>

            {/* Authentication Method Segmented Tabs */}
            <View
              style={[
                styles.authMethodTabs,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.authMethodTab,
                  authMethod === "passcode" && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => {
                  setAuthMethod("passcode");
                  setStep(1);
                  setPasscode("");
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={authMethod === "passcode" ? "#FFFFFF" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.authMethodTabText,
                    {
                      color:
                        authMethod === "passcode" ? "#FFFFFF" : colors.textMuted,
                    },
                  ]}
                >
                  Passcode (OTP)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.authMethodTab,
                  authMethod === "password" && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => {
                  setAuthMethod("password");
                  setStep(1);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={authMethod === "password" ? "#FFFFFF" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.authMethodTabText,
                    {
                      color:
                        authMethod === "password" ? "#FFFFFF" : colors.textMuted,
                    },
                  ]}
                >
                  Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* =================================================== */}
              {/* PASSCODE FLOW                                      */}
              {/* =================================================== */}
              {authMethod === "passcode" && (
                <>
                  {step === 1 ? (
                    /* Step 1: Identifier Input */
                    <>
                      <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: colors.text }]}>
                          Teacher ID / Email / Phone
                        </Text>
                        <View
                          style={[
                            styles.inputWrapper,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.inputBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="person-outline"
                            size={20}
                            color={colors.textMuted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="Enter Teacher ID, email or phone"
                            value={identifier}
                            onChangeText={setIdentifier}
                            autoCapitalize="none"
                            placeholderTextColor={colors.textMuted}
                            returnKeyType="done"
                            onSubmitEditing={handleRequestPasscode}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          { backgroundColor: colors.primary },
                          requestingPasscode && styles.disabledBtn,
                        ]}
                        onPress={handleRequestPasscode}
                        disabled={requestingPasscode}
                        activeOpacity={0.8}
                      >
                        {requestingPasscode ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <View style={styles.btnRow}>
                            <Ionicons
                              name="key"
                              size={18}
                              color="#FFFFFF"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.submitBtnText}>
                              Get 6-Digit Passcode
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    /* Step 2: 6-Digit Passcode Entry */
                    <>
                      {/* Test Mode Autofill Banner */}
                      {testPasscode && (
                        <View
                          style={[
                            styles.testBanner,
                            {
                              backgroundColor: isDark ? "#451A03" : "#FEF3C7",
                              borderColor: isDark ? "#78350F" : "#FDE68A",
                            },
                          ]}
                        >
                          <View style={styles.testBannerHeader}>
                            <View style={styles.testBadge}>
                              <Ionicons
                                name="flask-outline"
                                size={12}
                                color="#D97706"
                              />
                              <Text style={styles.testBadgeText}>
                                Test Mode Active
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.testExpireText,
                                { color: isDark ? "#FCD34D" : "#92400E" },
                              ]}
                            >
                              Valid for 10 mins
                            </Text>
                          </View>

                          <View style={styles.testCodeRow}>
                            <Text
                              style={[
                                styles.testCodeLabel,
                                { color: isDark ? "#FEF3C7" : "#78350F" },
                              ]}
                            >
                              Your Passcode:
                            </Text>
                            <View style={styles.testCodePill}>
                              <Text style={styles.testCodeText}>
                                {testPasscode}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.autofillBtn,
                              { backgroundColor: colors.primary },
                            ]}
                            onPress={() => setPasscode(testPasscode)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="copy-outline"
                              size={14}
                              color="#FFFFFF"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.autofillBtnText}>
                              Click to Autofill Passcode
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={styles.inputContainer}>
                        <Text
                          style={[
                            styles.label,
                            { color: colors.text, textAlign: "center" },
                          ]}
                        >
                          Enter 6-Digit Passcode
                        </Text>

                        {renderPasscodeBoxes()}

                        {/* Actions Row: Change ID & Resend Countdown */}
                        <View style={styles.passcodeActionsRow}>
                          <TouchableOpacity
                            onPress={() => {
                              setStep(1);
                              setPasscode("");
                            }}
                            activeOpacity={0.7}
                            style={styles.actionLinkBtn}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={14}
                              color={colors.textMuted}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.actionLinkText,
                                { color: colors.textMuted },
                              ]}
                            >
                              Change ID / Phone
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            disabled={resendCooldown > 0 || requestingPasscode}
                            onPress={handleRequestPasscode}
                            activeOpacity={0.7}
                            style={styles.actionLinkBtn}
                          >
                            <Ionicons
                              name="refresh-outline"
                              size={14}
                              color={
                                resendCooldown > 0
                                  ? colors.textMuted
                                  : colors.primary
                              }
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.actionLinkText,
                                {
                                  color:
                                    resendCooldown > 0
                                      ? colors.textMuted
                                      : colors.primary,
                                  fontWeight: "700",
                                },
                              ]}
                            >
                              {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : "Resend Passcode"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          { backgroundColor: colors.primary },
                          (isLoading || passcode.length !== 6) &&
                            styles.disabledBtn,
                        ]}
                        onPress={handleVerifyPasscode}
                        disabled={isLoading || passcode.length !== 6}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <View style={styles.btnRow}>
                            <Ionicons
                              name="log-in-outline"
                              size={18}
                              color="#FFFFFF"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.submitBtnText}>
                              Verify & Sign In
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              {/* =================================================== */}
              {/* PASSWORD FLOW (FALLBACK)                           */}
              {/* =================================================== */}
              {authMethod === "password" && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Teacher ID / Email / Phone
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={colors.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="Enter Teacher ID, email or phone"
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Password
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={colors.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1, color: colors.text }]}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={handlePasswordLogin}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={20}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      { backgroundColor: colors.primary },
                      isLoading && styles.disabledBtn,
                    ]}
                    onPress={handlePasswordLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <View style={styles.btnRow}>
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.submitBtnText}>Sign In</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Bottom Toggle Note */}
              <View style={styles.bottomSwitchRow}>
                {authMethod === "passcode" ? (
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMethod("password");
                      setStep(1);
                    }}
                    activeOpacity={0.7}
                    style={styles.switchMethodBtn}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={14}
                      color={colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.switchMethodText,
                        { color: colors.primary },
                      ]}
                    >
                      Sign in with Password instead
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMethod("passcode");
                      setStep(1);
                    }}
                    activeOpacity={0.7}
                    style={styles.switchMethodBtn}
                  >
                    <Ionicons
                      name="key-outline"
                      size={14}
                      color={colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.switchMethodText,
                        { color: colors.primary },
                      ]}
                    >
                      Sign in with 6-Digit Passcode instead
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 180,
    height: 120,
    marginBottom: 8,
  },
  portalBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
    gap: 4,
  },
  portalBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  authMethodTabs: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
  },
  authMethodTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  authMethodTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  formSection: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  passcodeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
    position: "relative",
  },
  digitBox: {
    width: 46,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: {
    fontSize: 22,
    fontWeight: "800",
  },
  hiddenPasscodeInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  passcodeActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  actionLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  actionLinkText: {
    fontSize: 12,
  },
  testBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  testBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  testBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  testBadgeText: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "700",
  },
  testExpireText: {
    fontSize: 11,
    fontWeight: "500",
  },
  testCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(217, 119, 6, 0.3)",
    marginBottom: 8,
  },
  testCodeLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  testCodePill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  testCodeText: {
    color: "#D97706",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  autofillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  autofillBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3d5ee1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  bottomSwitchRow: {
    alignItems: "center",
    marginTop: 24,
  },
  switchMethodBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  switchMethodText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
