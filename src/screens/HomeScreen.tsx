import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  type ImageStyle,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS } from "../core/theme";
import { USUARIO_LOGADO_MOCK, getPessoaResponsavelLogada } from "../core/session";
import type { RootStackParamList } from "../navigation/types";
import * as XLSX from "xlsx";

const D = {
  gold: "#e8b923",
  black: "#111111",
  charcoal: "#2a2a2a",
  pageBg: "#ececec",
  inputBg: "#e3e3e3",
  borderLight: "#d8d8d8",
  red: "#d32f2f",
  green: "#2e7d32",
  white: "#ffffff"
};

type NavKey = "painel" | "equipamentos" | "historico" | "relatorios";

/** Código de barras do crachá → nome do operador CET (para testes com leitor) */
export const OPERATOR_BARCODE_REGISTRY: Record<string, string> = {
  /** Atalhos só para testes: 1…10 = mesma ordem dos CET-OP-001…010 */
  "1": "Ricardo Mendes",
  "2": "Fernanda Costa",
  "3": "Pedro Albuquerque",
  "4": "Juliana Rocha",
  "5": "Marcos Antunes",
  "6": "Ana Carolina Souza",
  "7": "Lucas Ferreira",
  "8": "Mariana Braga",
  "9": "Rafael Monteiro",
  "10": "Tatiane Duarte",
  "CET-OP-001": "Ricardo Mendes",
  "CET-OP-002": "Fernanda Costa",
  "CET-OP-003": "Pedro Albuquerque",
  "CET-OP-004": "Juliana Rocha",
  "CET-OP-005": "Marcos Antunes",
  "CET-OP-006": "Ana Carolina Souza",
  "CET-OP-007": "Lucas Ferreira",
  "CET-OP-008": "Mariana Braga",
  "CET-OP-009": "Rafael Monteiro",
  "CET-OP-010": "Tatiane Duarte"
};

type ProductInfo = {
  name: string;
  serial: string;
  category: string;
  shelf: string;
  imageUri: string;
  /** Titular do item no patrimônio CET (vínculo); quem entrega/recebe é o crachá lido na hora. */
  operadorPatrimonio?: string;
};

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244ccff?w=400&q=80";

/** Códigos conhecidos do produto (itens reais CET); outros códigos geram cadastro automático */
const PRODUCT_BARCODE_REGISTRY: Record<string, ProductInfo> = {
  /** Atalhos só para testes: 1 = Smartphone, 2 = Impressora de mão */
  "1": {
    name: "Smartphone",
    serial: "NS: CET-SMART-01",
    category: "Telefonia / Comunicação móvel",
    shelf: "Prateleira C1",
    imageUri: "https://images.unsplash.com/photo-1511707171634-5f897ff02cc9?w=400&q=80",
    operadorPatrimonio: "Juliana Rocha"
  },
  "2": {
    name: "Impressora de mão",
    serial: "NS: CET-IMPMAO-01",
    category: "Impressão portátil",
    shelf: "Prateleira C2",
    imageUri: "https://images.unsplash.com/photo-1585386959988-609aece9293b?w=400&q=80",
    operadorPatrimonio: "Marcos Antunes"
  },
  "7891111111111": {
    name: "Smartphone",
    serial: "NS: CET-SMART-01",
    category: "Telefonia / Comunicação móvel",
    shelf: "Prateleira C1",
    imageUri: "https://images.unsplash.com/photo-1511707171634-5f897ff02cc9?w=400&q=80",
    operadorPatrimonio: "Juliana Rocha"
  },
  "7892222222222": {
    name: "Impressora de mão",
    serial: "NS: CET-IMPMAO-01",
    category: "Impressão portátil",
    shelf: "Prateleira C2",
    imageUri: "https://images.unsplash.com/photo-1585386959988-609aece9293b?w=400&q=80",
    operadorPatrimonio: "Marcos Antunes"
  },
  "CET-SMART-01": {
    name: "Smartphone",
    serial: "NS: CET-SMART-01",
    category: "Telefonia / Comunicação móvel",
    shelf: "Prateleira C1",
    imageUri: "https://images.unsplash.com/photo-1511707171634-5f897ff02cc9?w=400&q=80",
    operadorPatrimonio: "Juliana Rocha"
  },
  "CET-IMPMAO-01": {
    name: "Impressora de mão",
    serial: "NS: CET-IMPMAO-01",
    category: "Impressão portátil",
    shelf: "Prateleira C2",
    imageUri: "https://images.unsplash.com/photo-1585386959988-609aece9293b?w=400&q=80",
    operadorPatrimonio: "Marcos Antunes"
  }
};

function normalizeBarcode(raw: string) {
  return raw.trim().toUpperCase();
}

function resolveProductByBarcode(raw: string): ProductInfo {
  const key = normalizeBarcode(raw);
  if (key.length === 0) {
    return {
      name: "—",
      serial: "—",
      category: "—",
      shelf: "—",
      imageUri: DEFAULT_PRODUCT_IMAGE
    };
  }
  const known = PRODUCT_BARCODE_REGISTRY[key];
  if (known) return known;
  return {
    name: `Equipamento (${key})`,
    serial: `NS: ${key}`,
    category: "Cadastro automático",
    shelf: "—",
    imageUri: DEFAULT_PRODUCT_IMAGE
  };
}

function resolveOperatorName(raw: string): string | null {
  const key = normalizeBarcode(raw);
  if (!key) return null;
  return OPERATOR_BARCODE_REGISTRY[key] ?? null;
}

type ActivityRow = {
  id: string;
  product: string;
  serial: string;
  /** Operador CET da movimentação (entregou na retirada ou recebeu na devolução) */
  operadorCet: string;
  /** Operador CET a quem o equipamento está vinculado no patrimônio */
  operadorCetVinculo: string;
  /** Pessoa responsável (quem retira ou devolve na operação) */
  pessoaResponsavel: string;
  type: "retirada" | "devolucao";
  time: string;
};

/** `activityRows` está do mais novo para o mais antigo. */
function ultimaMovimentacaoDoSerial(serial: string, rows: ActivityRow[]): ActivityRow | undefined {
  return rows.find((r) => r.serial === serial);
}

const MOCK_ACTIVITY: ActivityRow[] = [
  {
    id: "1",
    product: "Smartphone",
    serial: "NS: CET-SMART-01",
    operadorCet: "Ricardo Mendes",
    operadorCetVinculo: "Juliana Rocha",
    pessoaResponsavel: "João Silva",
    type: "devolucao",
    time: "14:22 Hoje"
  },
  {
    id: "2",
    product: "Impressora de mão",
    serial: "NS: CET-IMPMAO-01",
    operadorCet: "Fernanda Costa",
    operadorCetVinculo: "Marcos Antunes",
    pessoaResponsavel: "Maria Oliveira",
    type: "retirada",
    time: "11:05 Hoje"
  },
  {
    id: "3",
    product: "Smartphone",
    serial: "NS: CET-SMART-01",
    operadorCet: "Pedro Albuquerque",
    operadorCetVinculo: "Juliana Rocha",
    pessoaResponsavel: "Carlos Eduardo Santos",
    type: "retirada",
    time: "09:40 Hoje"
  }
];

/** Separador compatível com Excel em português (Brasil), que usa “;” na lista. */
const CSV_SEP_BR = ";";

function escapeCsvFieldBr(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function filtrarAtividadePorPeriodo(
  rows: ActivityRow[],
  periodo: "dia" | "semana" | "mes"
): ActivityRow[] {
  if (periodo === "dia") return rows.filter((r) => /\bHoje\b/i.test(r.time));
  /** Semanal/mensal: no mock há só “Hoje”; com API, filtrar por intervalo de datas. */
  return rows;
}

const RELATORIO_HEADER = [
  "Produto",
  "Serial",
  "Operador CET",
  "Vínculo patrimônio",
  "Responsável",
  "Tipo",
  "Horário"
] as const;

function buildActivityAoa(rows: ActivityRow[]): string[][] {
  const header: string[] = [...RELATORIO_HEADER];
  const body = rows.map((r) => [
    r.product,
    r.serial,
    r.operadorCet,
    r.operadorCetVinculo,
    r.pessoaResponsavel,
    r.type === "retirada" ? "Retirada" : "Devolução",
    r.time
  ]);
  return [header, ...body];
}

function buildActivityCsv(rows: ActivityRow[]): string {
  const lines = [RELATORIO_HEADER.map(escapeCsvFieldBr).join(CSV_SEP_BR)];
  for (const r of rows) {
    const tipo = r.type === "retirada" ? "Retirada" : "Devolução";
    lines.push(
      [r.product, r.serial, r.operadorCet, r.operadorCetVinculo, r.pessoaResponsavel, tipo, r.time]
        .map(escapeCsvFieldBr)
        .join(CSV_SEP_BR)
    );
  }
  return lines.join("\r\n");
}

/** Na web baixa .xlsx (Excel real). No app nativo mantém CSV com “;” (compartilhar texto). */
function exportRelatorioArquivo(filenameBase: string, rows: ActivityRow[]) {
  if (Platform.OS === "web" && typeof globalThis.document !== "undefined") {
    const doc = globalThis.document;
    const aoa = buildActivityAoa(rows);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.xlsx`;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  const csv = buildActivityCsv(rows);
  exportRelatorioCsv(`${filenameBase}.csv`, csv);
}

function exportRelatorioCsv(filename: string, csv: string) {
  const bom = "\uFEFF";
  const payload = bom + csv;
  if (Platform.OS === "web" && typeof globalThis.document !== "undefined") {
    const doc = globalThis.document;
    const blob = new Blob([payload], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  Share.share({ title: filename, message: payload }).catch(() => {
    Alert.alert(
      "Exportar",
      "Não foi possível compartilhar o CSV. Use a versão web para baixar o arquivo."
    );
  });
}

function IconBox({
  name,
  color,
  bg
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.iconBox, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={name} size={22} color={color} />
    </View>
  );
}

function Sidebar({
  wide,
  activeNav,
  onNav,
  onSettings,
  onNewMovement
}: {
  wide: boolean;
  activeNav: NavKey;
  onNav: (k: NavKey) => void;
  onSettings: () => void;
  onNewMovement: () => void;
}) {
  const Item = ({
    id,
    label,
    icon
  }: {
    id: NavKey;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }) => {
    const active = activeNav === id;
    return (
      <Pressable
        onPress={() => onNav(id)}
        style={({ pressed }) => [
          styles.navItem,
          wide ? styles.navItemWide : styles.navItemCompact,
          active && { backgroundColor: D.gold },
          pressed && { opacity: 0.88 }
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={active ? D.black : "#555"}
          style={wide ? { marginRight: 12 } : { marginBottom: 4 }}
        />
        <Text
          style={[
            styles.navLabel,
            { color: active ? D.black : "#333" },
            !wide && { fontSize: 11, textAlign: "center" }
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const bottomLink = (
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    label: string,
    onPress: () => void
  ) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bottomLink, pressed && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name={icon} size={20} color="#444" style={{ marginRight: 10 }} />
      <Text style={styles.bottomLinkText}>{label}</Text>
    </Pressable>
  );

  const navFour = (
    <>
      <Item id="painel" label="Painel" icon="view-dashboard-outline" />
      <Item id="equipamentos" label="Equipamentos" icon="package-variant" />
      <Item id="historico" label="Histórico" icon="history" />
      <Item id="relatorios" label="Relatórios" icon="file-chart-outline" />
    </>
  );

  if (wide) {
    return (
      <View style={styles.sidebarWide}>
        <Text style={styles.logo}>CET COMUNICAÇÃO</Text>
        <View style={styles.navBlock}>{navFour}</View>
        <Pressable
          onPress={onNewMovement}
          style={({ pressed }) => [styles.btnNewMovement, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnNewMovementText}>+ Nova Movimentação</Text>
        </Pressable>
        <View style={{ marginTop: "auto", paddingTop: 16 }}>
          {bottomLink("cog-outline", "Configurações", onSettings)}
          {bottomLink("help-circle-outline", "Suporte", () => {})}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sidebarMobileWrap}>
      <Text style={[styles.logo, styles.logoMobile]}>CET COMUNICAÇÃO</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navHScroll}
      >
        {navFour}
      </ScrollView>
      <View style={styles.mobileNewMovWrap}>
        <Pressable
          onPress={onNewMovement}
          style={({ pressed }) => [styles.btnNewMovement, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnNewMovementText}>+ Nova Movimentação</Text>
        </Pressable>
      </View>
      <View style={styles.mobileBottomRow}>
        {bottomLink("cog-outline", "Configurações", onSettings)}
        {bottomLink("help-circle-outline", "Suporte", () => {})}
      </View>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 920;

  const [activeNav, setActiveNav] = useState<NavKey>("painel");
  const [activityFilter, setActivityFilter] = useState<"hoje" | "semana" | "mes">("hoje");
  const [activityStatusFilter, setActivityStatusFilter] = useState<"todos" | "retirada" | "devolucao">("todos");
  const [activityOperadorFilter, setActivityOperadorFilter] = useState<string>("todos");
  const [activityFilterMenuOpen, setActivityFilterMenuOpen] = useState(false);
  const activityFilterAnchorRef = useRef<View>(null);
  const [productBarcode, setProductBarcode] = useState("");
  const [productResolved, setProductResolved] = useState<ProductInfo | null>(null);
  const [productScanHint, setProductScanHint] = useState<string | null>(null);
  const [operatorBarcode, setOperatorBarcode] = useState("");
  const [operadorNome, setOperadorNome] = useState<string | null>(null);
  const [operatorScanHint, setOperatorScanHint] = useState<string | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>(() => [...MOCK_ACTIVITY]);

  const confirmProductBarcode = useCallback(() => {
    const raw = productBarcode.trim();
    if (!raw) {
      setProductScanHint("Informe o código do produto.");
      setProductResolved(null);
      return;
    }
    setProductScanHint(null);
    const info = resolveProductByBarcode(raw);
    setProductResolved(info);
    setOperadorNome(null);
    setOperatorBarcode("");
    setOperatorScanHint(null);
    if (!PRODUCT_BARCODE_REGISTRY[normalizeBarcode(raw)]) {
      setProductScanHint("Produto novo — cadastrado automaticamente a partir do código.");
    }
  }, [productBarcode]);

  const confirmOperatorBarcode = useCallback(() => {
    const raw = operatorBarcode.trim();
    if (!raw) {
      setOperatorScanHint("Informe o código do operador.");
      setOperadorNome(null);
      return;
    }
    const name = resolveOperatorName(raw);
    if (!name) {
      setOperadorNome(null);
      setOperatorScanHint(
        "Código de operador não encontrado. Teste com 1 a 10 ou CET-OP-001 a CET-OP-010."
      );
      return;
    }
    setOperatorScanHint(null);
    setOperadorNome(name);
  }, [operatorBarcode]);

  const operadoresAtividadeOpcoes = useMemo(() => {
    const s = new Set<string>();
    activityRows.forEach((r) => {
      s.add(r.operadorCet);
      s.add(r.operadorCetVinculo);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activityRows]);

  const atividadeFiltrada = useMemo(() => {
    return activityRows.filter((row) => {
      if (activityStatusFilter !== "todos" && row.type !== activityStatusFilter) return false;
      if (activityOperadorFilter !== "todos") {
        const op = activityOperadorFilter;
        if (row.operadorCet !== op && row.operadorCetVinculo !== op) return false;
      }
      return true;
    });
  }, [activityRows, activityStatusFilter, activityOperadorFilter]);

  const ultimaDoProdutoAtual = useMemo(() => {
    if (!productResolved?.serial) return undefined;
    return ultimaMovimentacaoDoSerial(productResolved.serial, activityRows);
  }, [productResolved?.serial, activityRows]);

  const equipamentoRetirado =
    Boolean(productResolved) && ultimaDoProdutoAtual?.type === "retirada";

  const registrarMovimentacao = useCallback(
    (tipo: "retirada" | "devolucao") => {
      if (!productResolved) {
        Alert.alert("Produto", "Escaneie e confirme o produto antes de registrar.");
        return;
      }
      if (!operadorNome) {
        Alert.alert("Operador", "Escaneie e confirme o crachá do operador CET.");
        return;
      }

      const info = productResolved;
      const opNome = operadorNome;
      const pessoa = getPessoaResponsavelLogada();

      const ult = ultimaMovimentacaoDoSerial(info.serial, activityRows);
      if (tipo === "retirada") {
        if (ult?.type === "retirada") {
          Alert.alert(
            "Retirada",
            "Este equipamento já está retirado. Confirme a devolução na área de atividade (botão ao lado dos filtros)."
          );
          return;
        }
      } else {
        if (!ult || ult.type !== "retirada") {
          Alert.alert(
            "Devolução",
            "Este equipamento não consta como retirado. Confirme o produto ou registre uma retirada primeiro."
          );
          return;
        }
      }

      /** Patrimônio do cadastro do item; se não houver, assume o mesmo operador do crachá. */
      const operadorCetVinculo = info.operadorPatrimonio ?? opNome;

      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} Hoje`;

      const newRow: ActivityRow = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        product: info.name,
        serial: info.serial,
        operadorCet: opNome,
        operadorCetVinculo,
        pessoaResponsavel: pessoa,
        type: tipo,
        time
      };

      setActivityRows((prev) => [newRow, ...prev]);
      Alert.alert(
        tipo === "retirada" ? "Retirada registrada" : "Devolução registrada",
        `${info.name} · ${opNome} · ${pessoa}`
      );

      setProductBarcode("");
      setProductResolved(null);
      setProductScanHint(null);
      setOperatorBarcode("");
      setOperadorNome(null);
      setOperatorScanHint(null);
    },
    [activityRows, operadorNome, productResolved]
  );

  const closeActivityFilterMenu = useCallback(() => setActivityFilterMenuOpen(false), []);

  const filtrosAtividadeAtivos =
    activityStatusFilter !== "todos" || activityOperadorFilter !== "todos";

  useEffect(() => {
    if (!activityFilterMenuOpen || Platform.OS !== "web") return;
    const onPointerDown = (e: PointerEvent) => {
      const root = activityFilterAnchorRef.current as unknown as HTMLElement | undefined;
      const target = e.target;
      if (root && target instanceof Node && root.contains(target)) return;
      closeActivityFilterMenu();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [activityFilterMenuOpen, closeActivityFilterMenu]);

  const baixarRelatorio = useCallback((periodo: "dia" | "semana" | "mes") => {
    const filtered = filtrarAtividadePorPeriodo(activityRows, periodo);
    if (filtered.length === 0) {
      Alert.alert(
        "Sem dados",
        "Não há movimentações neste período para exportar. Quando a API estiver ligada, o filtro usará as datas reais."
      );
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const slug = { dia: "dia", semana: "semanal", mes: "mensal" }[periodo];
    exportRelatorioArquivo(`cet-equipamentos-relatorio-${slug}-${dateStr}`, filtered);
  }, [activityRows]);

  const onSettings = useCallback(() => navigation.navigate("Sobre"), [navigation]);

  const bottomPad = Math.max(insets.bottom, 20) + 24;

  const mainBody = (
    <View style={[styles.mainScrollContent, { paddingBottom: bottomPad }]}>
      <View style={styles.sessionTopBar}>
        <MaterialCommunityIcons name="account-check" size={22} color={D.gold} />
        <Text style={styles.sessionTopBarText}>Logado como {USUARIO_LOGADO_MOCK.nome}</Text>
      </View>

      <View style={styles.mainHeaderRow}>
        <View>
          <Text style={styles.kicker}>MÓDULO OPERACIONAL</Text>
          <Text style={styles.mainTitle}>Controle de Equipamentos</Text>
        </View>
        <View style={styles.mainHeaderRight}>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Sistema Online</Text>
          </View>
        </View>
      </View>

      <Text style={styles.scanStepLabel}>1. Produto</Text>
      <View style={styles.scanRow}>
        <MaterialCommunityIcons name="barcode-scan" size={22} color="#666" style={{ marginLeft: 14, marginRight: 8 }} />
        <TextInput
          value={productBarcode}
          onChangeText={setProductBarcode}
          placeholder="Escanear código do produto"
          placeholderTextColor="#888"
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={confirmProductBarcode}
          style={[
            styles.scanInput,
            Platform.OS === "web" && ({ outlineStyle: "none" } as Record<string, unknown>)
          ]}
        />
        <Pressable
          onPress={confirmProductBarcode}
          style={({ pressed }) => [styles.enterBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.enterBtnText}>Confirmar</Text>
        </Pressable>
      </View>
      {productScanHint ? <Text style={styles.scanHint}>{productScanHint}</Text> : null}

      <Text style={styles.sectionLabel}>Produto identificado</Text>
      {productResolved ? (
        <View style={styles.productCard}>
          <View style={styles.productThumb}>
            <Image
              source={{ uri: productResolved.imageUri }}
              style={styles.productImage as ImageStyle}
              resizeMode="cover"
            />
          </View>
          <View style={styles.productMeta}>
            <Text style={styles.productName}>{productResolved.name}</Text>
            <Text style={styles.productLine}>{productResolved.serial}</Text>
            <Text style={styles.productLineMuted}>{productResolved.category}</Text>
            <Text style={styles.productLineMuted}>{productResolved.shelf}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.productPlaceholder}>
          <MaterialCommunityIcons name="package-variant-closed" size={36} color="#bbb" />
          <Text style={styles.productPlaceholderText}>
            Escaneie o produto e confirme para carregar os dados.
          </Text>
        </View>
      )}

      <Text style={styles.scanStepLabel}>2. Operador CET (crachá)</Text>
      <View style={styles.scanRow}>
        <MaterialCommunityIcons name="card-account-details" size={22} color="#666" style={{ marginLeft: 14, marginRight: 8 }} />
        <TextInput
          value={operatorBarcode}
          onChangeText={setOperatorBarcode}
          placeholder="Escanear código do operador"
          placeholderTextColor="#888"
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={confirmOperatorBarcode}
          style={[
            styles.scanInput,
            Platform.OS === "web" && ({ outlineStyle: "none" } as Record<string, unknown>)
          ]}
        />
        <Pressable
          onPress={confirmOperatorBarcode}
          style={({ pressed }) => [styles.enterBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.enterBtnText}>Confirmar</Text>
        </Pressable>
      </View>
      {operatorScanHint ? <Text style={[styles.scanHint, styles.scanHintError]}>{operatorScanHint}</Text> : null}

      <View style={styles.operatorResultBox}>
        <Text style={styles.fakeSelectLabel}>
          {equipamentoRetirado ? "Operador CET (recebe a devolução)" : "Operador CET (entrega na retirada)"}
        </Text>
        <Text
          style={[styles.operatorResultName, operadorNome == null && styles.fakeSelectPlaceholder]}
          numberOfLines={2}
        >
          {operadorNome ?? "Aguardando leitura do crachá..."}
        </Text>
      </View>

      {!equipamentoRetirado ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => registrarMovimentacao("retirada")}
            style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.92 }]}
          >
            <IconBox name="package-up" color={D.red} bg="rgba(211,47,47,0.12)" />
            <Text style={styles.actionBtnTitle}>Retirada</Text>
            <Text style={styles.actionBtnSub}>(RETIRAR)</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionRowHint}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#666" />
          <Text style={styles.actionRowHintText}>
            Equipamento retirado — a devolução é confirmada na área &quot;Atividade Recente&quot;, ao lado dos filtros.
          </Text>
        </View>
      )}

      {!wide && (
        <>
          <StatsBlock />
          <ReportBlock onBaixar={baixarRelatorio} />
          <LiveInventoryCard />
        </>
      )}

      <View style={[styles.activityHeader, activityFilterMenuOpen && styles.activityHeaderMenuOpen]}>
        <View style={styles.activityHeaderTop}>
          <Text style={styles.activityTitle}>Atividade Recente</Text>
          <View ref={activityFilterAnchorRef} collapsable={false} style={styles.activityFiltroAnchor}>
            <Pressable
              onPress={() => setActivityFilterMenuOpen((o) => !o)}
              style={({ pressed }) => [
                styles.activityFiltroBtn,
                activityFilterMenuOpen && styles.activityFiltroBtnOpen,
                pressed && { opacity: 0.9 }
              ]}
            >
              <MaterialCommunityIcons name="filter-variant" size={20} color={D.black} />
              <Text style={styles.activityFiltroBtnText}>Filtro</Text>
              {filtrosAtividadeAtivos ? <View style={styles.activityFiltroBadge} /> : null}
              <MaterialCommunityIcons
                name={activityFilterMenuOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#555"
              />
            </Pressable>
            {activityFilterMenuOpen ? (
              <View style={styles.activityFiltroPanel}>
                <Text style={styles.activityFiltroSectionTitle}>Operador CET</Text>
                <Text style={styles.activityFiltroSectionHint}>Quem entregou/recebeu ou titular do item no movimento</Text>
                <View style={styles.activityFiltroChipWrap}>
                  <Pressable
                    onPress={() => setActivityOperadorFilter("todos")}
                    style={[
                      styles.activityMetaChip,
                      activityOperadorFilter === "todos" ? styles.activityMetaChipOn : styles.activityMetaChipOff
                    ]}
                  >
                    <Text
                      style={[
                        styles.activityMetaChipText,
                        activityOperadorFilter === "todos"
                          ? styles.activityMetaChipTextOn
                          : styles.activityMetaChipTextOff
                      ]}
                    >
                      Todos
                    </Text>
                  </Pressable>
                  {operadoresAtividadeOpcoes.map((nome) => (
                    <Pressable
                      key={nome}
                      onPress={() => setActivityOperadorFilter(nome)}
                      style={[
                        styles.activityMetaChip,
                        activityOperadorFilter === nome ? styles.activityMetaChipOn : styles.activityMetaChipOff
                      ]}
                    >
                      <Text
                        style={[
                          styles.activityMetaChipText,
                          activityOperadorFilter === nome
                            ? styles.activityMetaChipTextOn
                            : styles.activityMetaChipTextOff
                        ]}
                        numberOfLines={1}
                      >
                        {nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.activityFiltroSectionDivider} />
                <Text style={styles.activityFiltroSectionTitle}>Status</Text>
                <View style={styles.activityFiltroChipWrap}>
                  {(
                    [
                      ["todos", "Todos"],
                      ["retirada", "Retirada"],
                      ["devolucao", "Devolução"]
                    ] as const
                  ).map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => setActivityStatusFilter(key)}
                      style={[
                        styles.activityMetaChip,
                        activityStatusFilter === key ? styles.activityMetaChipOn : styles.activityMetaChipOff
                      ]}
                    >
                      <Text
                        style={[
                          styles.activityMetaChipText,
                          activityStatusFilter === key
                            ? styles.activityMetaChipTextOn
                            : styles.activityMetaChipTextOff
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={closeActivityFilterMenu}
                  style={({ pressed }) => [styles.activityFiltroFechar, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.activityFiltroFecharText}>Fechar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {equipamentoRetirado && ultimaDoProdutoAtual ? (
          <View style={styles.devolucaoBanner}>
            <View style={styles.devolucaoBannerText}>
              <Text style={styles.devolucaoBannerTitle}>Devolução</Text>
              <Text style={styles.devolucaoBannerSub}>
                Retirado por{" "}
                <Text style={styles.devolucaoBannerEm}>{ultimaDoProdutoAtual.pessoaResponsavel}</Text>
                {" · "}
                {ultimaDoProdutoAtual.time}
              </Text>
            </View>
            <Pressable
              onPress={() => registrarMovimentacao("devolucao")}
              style={({ pressed }) => [styles.devolucaoBannerBtn, pressed && { opacity: 0.9 }]}
            >
              <MaterialCommunityIcons name="package-down" size={20} color={D.black} />
              <Text style={styles.devolucaoBannerBtnText}>Confirmar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {(
            [
              ["hoje", "Hoje"],
              ["semana", "Esta Semana"],
              ["mes", "Este Mês"]
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setActivityFilter(key)}
              style={[
                styles.filterChip,
                activityFilter === key ? styles.filterChipOn : styles.filterChipOff
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activityFilter === key ? styles.filterChipTextOn : styles.filterChipTextOff
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.calBtn}>
            <MaterialCommunityIcons name="calendar-month-outline" size={22} color={D.black} />
          </Pressable>
        </View>
      </View>

      <View style={styles.activityList}>
        {atividadeFiltrada.length === 0 ? (
          <Text style={styles.activityEmptyFilter}>Nenhuma atividade com os filtros selecionados.</Text>
        ) : null}
        {atividadeFiltrada.map((row) => (
          <View key={row.id} style={styles.activityRow}>
            <View
              style={[
                styles.activityBar,
                { backgroundColor: row.type === "devolucao" ? D.gold : D.red }
              ]}
            />
            <View style={styles.activityBody}>
              <View style={styles.activityTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityProduct}>{row.product}</Text>
                  <Text style={styles.activitySerial}>{row.serial}</Text>
                  {row.operadorCetVinculo !== row.operadorCet ? (
                    <Text style={styles.activityVinculoLine}>
                      <Text style={styles.activityPeopleLabel}>Vínculo patrimonial do item: </Text>
                      <Text style={styles.activityPeopleName}>{row.operadorCetVinculo}</Text>
                    </Text>
                  ) : null}
                  <View style={styles.activityPeople}>
                    {row.type === "retirada" ? (
                      <>
                        <Text style={styles.activityPeopleLine}>
                          <Text style={styles.activityPeopleLabel}>Operador CET (entregou): </Text>
                          <Text style={styles.activityPeopleName}>{row.operadorCet}</Text>
                        </Text>
                        <Text style={styles.activityPeopleLine}>
                          <Text style={styles.activityPeopleLabel}>Pessoa responsável (retirou): </Text>
                          <Text style={styles.activityPeopleName}>{row.pessoaResponsavel}</Text>
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.activityPeopleLine}>
                          <Text style={styles.activityPeopleLabel}>Operador CET (recebeu): </Text>
                          <Text style={styles.activityPeopleName}>{row.operadorCet}</Text>
                        </Text>
                        <Text style={styles.activityPeopleLine}>
                          <Text style={styles.activityPeopleLabel}>Pessoa responsável (devolveu): </Text>
                          <Text style={styles.activityPeopleName}>{row.pessoaResponsavel}</Text>
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View
                    style={[
                      styles.badge,
                      row.type === "devolucao" ? styles.badgeReturn : styles.badgeWithdraw
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        row.type === "devolucao" ? styles.badgeTextReturn : styles.badgeTextWithdraw
                      ]}
                    >
                      {row.type === "devolucao" ? "DEVOLUÇÃO" : "RETIRADA"}
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>{row.time}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {wide ? (
        <View style={styles.rowLayout}>
          <Sidebar
            wide
            activeNav={activeNav}
            onNav={setActiveNav}
            onSettings={onSettings}
            onNewMovement={() => {}}
          />
          <View style={[styles.centerCol, Platform.OS === "web" && styles.scrollOverflowVisible]}>
            <ScrollView
              style={[styles.mainScroll, Platform.OS === "web" && styles.scrollOverflowVisible]}
              showsVerticalScrollIndicator={false}
            >
              {mainBody}
            </ScrollView>
          </View>
          <View style={styles.rightCol}>
            <ScrollView
              contentContainerStyle={[
                styles.rightScrollContent,
                { paddingBottom: Math.max(insets.bottom, 16) + 16 }
              ]}
              showsVerticalScrollIndicator={false}
            >
              <StatsBlock />
              <ReportBlock onBaixar={baixarRelatorio} />
              <LiveInventoryCard />
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView
          style={Platform.OS === "web" ? styles.scrollOverflowVisible : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mobileScrollContent}
        >
          <Sidebar
            wide={false}
            activeNav={activeNav}
            onNav={setActiveNav}
            onSettings={onSettings}
            onNewMovement={() => {}}
          />
          {mainBody}
        </ScrollView>
      )}
    </View>
  );
}

function StatsBlock() {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsCardTitle}>Resumo Diário</Text>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Total de Retiradas</Text>
        <View style={styles.statValueRow}>
          <Text style={[styles.statValue, { color: D.red }]}>42</Text>
          <MaterialCommunityIcons name="trending-up" size={22} color={D.red} />
        </View>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Total de Devoluções</Text>
        <View style={styles.statValueRow}>
          <Text style={[styles.statValue, { color: D.gold }]}>38</Text>
          <MaterialCommunityIcons name="trending-down" size={22} color={D.gold} />
        </View>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Saldo Líquido</Text>
        <Text style={styles.netBalance}>-4 Itens</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "72%" }]} />
        </View>
      </View>
    </View>
  );
}

function ReportBlock({
  onBaixar
}: {
  onBaixar: (periodo: "dia" | "semana" | "mes") => void;
}) {
  const rows = [
    { periodo: "dia" as const, icon: "calendar-today" as const, label: "Relatório do dia" },
    { periodo: "semana" as const, icon: "calendar-week" as const, label: "Relatório semanal" },
    { periodo: "mes" as const, icon: "calendar-month-outline" as const, label: "Relatório mensal" }
  ];
  return (
    <View style={styles.reportCard}>
      <Text style={styles.reportTitle}>Gerar Relatório</Text>
      {rows.map((r, index) => (
        <Pressable
          key={r.periodo}
          onPress={() => onBaixar(r.periodo)}
          style={({ pressed }) => [
            styles.reportRow,
            index === rows.length - 1 && styles.reportRowLast,
            pressed && { backgroundColor: "#f5f5f5" }
          ]}
        >
          <MaterialCommunityIcons name={r.icon} size={22} color="#333" />
          <Text style={styles.reportRowText}>{r.label}</Text>
          <MaterialCommunityIcons
            name="download-outline"
            size={22}
            color={D.gold}
            style={{ marginLeft: "auto" }}
          />
        </Pressable>
      ))}
    </View>
  );
}

function LiveInventoryCard() {
  return (
    <Pressable style={({ pressed }) => [styles.liveCard, pressed && { opacity: 0.95 }]}>
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80"
        }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.liveOverlay} />
      <View style={styles.liveTextWrap}>
        <Text style={styles.liveTitle}>Inventário em Tempo Real</Text>
        <Text style={styles.liveSub}>Ver mapa em tempo real de todos os equipamentos</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.pageBg,
    alignSelf: "stretch"
  },
  rowLayout: {
    flex: 1,
    flexDirection: "row",
    alignSelf: "stretch",
    ...(Platform.OS === "web" ? ({ minHeight: "100%" } as object) : {})
  },
  sidebarWide: {
    width: 248,
    backgroundColor: D.white,
    borderRightWidth: 1,
    borderRightColor: D.borderLight,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24
  },
  sidebarMobileWrap: {
    backgroundColor: D.white,
    borderBottomWidth: 1,
    borderBottomColor: D.borderLight
  },
  logoMobile: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10
  },
  navHScroll: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8
  },
  mobileNewMovWrap: { paddingHorizontal: 16, marginTop: 12 },
  mobileBottomRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    columnGap: 20
  },
  mobileScrollContent: { flexGrow: 1, paddingBottom: 8 },
  logo: {
    fontFamily: FONTS.extrabold,
    fontSize: 15,
    letterSpacing: 0.5,
    color: D.black,
    marginBottom: 20
  },
  navBlock: { gap: 6, marginBottom: 20 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  navItemWide: { flexDirection: "row" },
  navItemCompact: {
    flexDirection: "column",
    minWidth: 88,
    marginRight: 8,
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  navLabel: { fontFamily: FONTS.semibold, fontSize: 14 },
  btnNewMovement: {
    backgroundColor: D.black,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnNewMovementText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: D.white
  },
  bottomLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10
  },
  bottomLinkText: { fontFamily: FONTS.semibold, fontSize: 14, color: "#333" },
  centerCol: { flex: 1, minWidth: 0 },
  mainScroll: { flex: 1 },
  scrollOverflowVisible: { overflow: "visible" } as const,
  mainScrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  sessionTopBar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0"
  },
  sessionTopBarText: { fontFamily: FONTS.bold, fontSize: 14, color: D.black },
  rightCol: {
    width: 300,
    borderLeftWidth: 1,
    borderLeftColor: D.borderLight,
    backgroundColor: D.pageBg
  },
  rightScrollContent: { padding: 16, gap: 16 },
  mainHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 12
  },
  kicker: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#666",
    marginBottom: 4
  },
  mainTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 26,
    color: D.black,
    maxWidth: 320
  },
  mainHeaderRight: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: D.green
  },
  onlineText: { fontFamily: FONTS.semibold, fontSize: 12, color: "#333" },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: D.inputBg,
    borderRadius: 12,
    marginBottom: 22,
    overflow: "hidden",
    minHeight: 52
  },
  scanInput: {
    flex: 1,
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: D.black,
    paddingVertical: Platform.OS === "web" ? 14 : 12
  },
  enterBtn: {
    backgroundColor: D.red,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginRight: 4,
    marginVertical: 4,
    borderRadius: 8
  },
  enterBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: D.white },
  scanStepLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: "#555",
    marginBottom: 8,
    marginTop: 4
  },
  scanHint: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: "#666",
    marginTop: 6,
    marginBottom: 4
  },
  scanHintError: { color: D.red },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#444",
    marginBottom: 10,
    marginTop: 8
  },
  productPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#f7f7f7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 20,
    marginBottom: 18
  },
  productPlaceholderText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: "#888",
    flex: 1
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: D.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: D.gold,
    padding: 14,
    gap: 14,
    marginBottom: 18
  },
  productThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ddd"
  },
  productImage: { width: "100%", height: "100%" },
  productMeta: { flex: 1, justifyContent: "center", gap: 4 },
  productName: { fontFamily: FONTS.extrabold, fontSize: 17, color: D.black },
  productLine: { fontFamily: FONTS.semibold, fontSize: 13, color: "#333" },
  productLineMuted: { fontFamily: FONTS.semibold, fontSize: 12, color: "#777" },
  operatorResultBox: {
    backgroundColor: D.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.borderLight,
    padding: 14,
    marginBottom: 16
  },
  operatorResultName: {
    fontFamily: FONTS.extrabold,
    fontSize: 17,
    color: D.black,
    marginTop: 4
  },
  fakeSelectLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "#666",
    marginBottom: 8,
    letterSpacing: 0.3
  },
  fakeSelectPlaceholder: { color: "#999" },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  actionRowHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0"
  },
  actionRowHintText: {
    flex: 1,
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: "#555",
    lineHeight: 18
  },
  devolucaoBanner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(232,185,35,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.gold
  },
  devolucaoBannerText: { flex: 1, minWidth: 180 },
  devolucaoBannerTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 14,
    color: D.black,
    marginBottom: 4
  },
  devolucaoBannerSub: { fontFamily: FONTS.semibold, fontSize: 13, color: "#444", lineHeight: 18 },
  devolucaoBannerEm: { fontFamily: FONTS.extrabold, color: D.black },
  devolucaoBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: D.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  devolucaoBannerBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: D.black },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  withdrawBtn: {
    flex: 1,
    backgroundColor: D.black,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center"
  },
  actionBtnTitle: { fontFamily: FONTS.extrabold, fontSize: 16, color: D.white },
  actionBtnSub: { fontFamily: FONTS.semibold, fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  statsCard: {
    backgroundColor: D.charcoal,
    borderRadius: 14,
    padding: 18
  },
  statsCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 16
  },
  statRow: { marginBottom: 14 },
  statLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statValue: { fontFamily: FONTS.extrabold, fontSize: 32 },
  netBalance: { fontFamily: FONTS.bold, fontSize: 16, color: D.white, marginTop: 4 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 8,
    overflow: "hidden"
  },
  progressFill: { height: "100%", backgroundColor: D.gold, borderRadius: 3 },
  reportCard: {
    backgroundColor: D.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: D.borderLight
  },
  reportTitle: { fontFamily: FONTS.extrabold, fontSize: 16, color: D.black, marginBottom: 8 },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  reportRowText: { fontFamily: FONTS.semibold, fontSize: 15, color: D.black },
  reportRowLast: { borderBottomWidth: 0 },
  liveCard: {
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  liveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  liveTextWrap: { padding: 14, zIndex: 1 },
  liveTitle: { fontFamily: FONTS.extrabold, fontSize: 14, color: D.white, marginBottom: 4 },
  liveSub: { fontFamily: FONTS.semibold, fontSize: 12, color: "rgba(255,255,255,0.9)" },
  activityHeader: { marginBottom: 12 },
  activityHeaderMenuOpen: { zIndex: 250, elevation: 18 },
  activityHeaderTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10
  },
  activityTitle: { fontFamily: FONTS.extrabold, fontSize: 18, color: D.black, marginBottom: 0 },
  activityFiltroAnchor: { position: "relative", alignSelf: "flex-end" },
  activityFiltroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: D.borderLight,
    backgroundColor: D.white
  },
  activityFiltroBtnOpen: { borderColor: D.gold },
  activityFiltroBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: D.black },
  activityFiltroBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.red,
    marginRight: -4
  },
  activityFiltroPanel: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 8,
    minWidth: 288,
    maxWidth: 340,
    padding: 14,
    backgroundColor: D.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12
      },
      android: { elevation: 10 },
      default: { boxShadow: "0 6px 20px rgba(0,0,0,0.12)" } as object
    })
  },
  activityFiltroSectionTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 13,
    color: D.black,
    marginBottom: 4
  },
  activityFiltroSectionHint: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: "#888",
    marginBottom: 10
  },
  activityFiltroSectionDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 14
  },
  activityFiltroChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityFiltroFechar: { marginTop: 14, paddingVertical: 10, alignItems: "center" },
  activityFiltroFecharText: { fontFamily: FONTS.bold, fontSize: 13, color: "#555" },
  activityMetaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: 160
  },
  activityMetaChipOn: { backgroundColor: D.black },
  activityMetaChipOff: { backgroundColor: D.white, borderWidth: 1, borderColor: D.borderLight },
  activityMetaChipText: { fontFamily: FONTS.semibold, fontSize: 11 },
  activityMetaChipTextOn: { color: D.white },
  activityMetaChipTextOff: { color: "#444" },
  activityEmptyFilter: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    paddingVertical: 20
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterChipOn: { backgroundColor: D.black },
  filterChipOff: { backgroundColor: D.white, borderWidth: 1, borderColor: D.borderLight },
  filterChipText: { fontFamily: FONTS.semibold, fontSize: 12 },
  filterChipTextOn: { color: D.white },
  filterChipTextOff: { color: "#555" },
  calBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.white,
    borderWidth: 1,
    borderColor: D.borderLight,
    alignItems: "center",
    justifyContent: "center"
  },
  activityList: { gap: 10, marginBottom: 24 },
  activityRow: {
    flexDirection: "row",
    backgroundColor: D.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: D.borderLight
  },
  activityBar: { width: 4 },
  activityBody: { flex: 1, padding: 14 },
  activityTop: { flexDirection: "row", gap: 12 },
  activityProduct: { fontFamily: FONTS.bold, fontSize: 15, color: D.black },
  activitySerial: { fontFamily: FONTS.semibold, fontSize: 12, color: "#666", marginTop: 4 },
  activityVinculoLine: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: "#444",
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  activityPeople: { marginTop: 8, gap: 4 },
  activityPeopleLine: { fontFamily: FONTS.semibold, fontSize: 12, color: "#444", marginTop: 2 },
  activityPeopleLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: "#777" },
  activityPeopleName: { fontFamily: FONTS.bold, fontSize: 12, color: "#333" },
  activityTime: { fontFamily: FONTS.semibold, fontSize: 11, color: "#999" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeReturn: { backgroundColor: "rgba(46,125,50,0.12)" },
  badgeWithdraw: { backgroundColor: "rgba(211,47,47,0.12)" },
  badgeText: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.3 },
  badgeTextReturn: { color: D.green },
  badgeTextWithdraw: { color: D.red }
});
