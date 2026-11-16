import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, ScrollView, TextInput, Platform, StatusBar, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const DN = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WK = { 1: ['Empurrar', 'push'], 2: ['Pernas e glúteos', 'legs'], 4: ['Puxar e core', 'pull'], 6: ['Corpo inteiro', 'full'] };
const EX = {
  push: [['Flexões', 'até perto da falha', 4], ['Flexões pike', '8 a 12', 4], ['Fundos entre cadeiras', '10 a 15', 3], ['Flexões diamante', 'até perto da falha', 3], ['Prancha', '45 a 60 s', 3]],
  legs: [['Agachamento búlgaro', '8 a 12 por perna', 4], ['Agachamento com mochila', '12 a 15', 4], ['Elevação de anca a uma perna', '12 por perna', 3], ['Gémeos no degrau', '20', 4]],
  pull: [['Remada invertida (mesa)', '8 a 12', 4], ['Remada com mochila', '12', 3], ['Superman', '15', 3], ['Elevação de pernas', '12 a 15', 3], ['Prancha', '45 a 60 s', 3]],
  full: [['Flexões com pausa', '8 a 10, pausa de 2 s', 3], ['Agachamento a uma perna assistido', '6 a 8 por perna', 3], ['Burpees', '10', 3], ['Prancha lateral', '30 s por lado', 3]],
};

const mk = (id, t, n, s = '') => ({ id, t, n, s });
function defaults() {
  const o = {};
  for (let w = 0; w < 7; w++) {
    const tr = WK[w];
    if (w === 0) o[w] = [mk('biblia', '08:00', 'Bíblia e meditação', 'Versão longa'), mk('rev', '17:00', 'Revisão da semana'), mk('plan', '20:00', 'Planear a próxima semana')];
    else if (w === 6) o[w] = [mk('biblia', '06:30', 'Bíblia e meditação'), mk('treino', '08:00', 'Treino: ' + tr[0]), mk('prog', '09:30', 'Programação ou BYU-Pathway', '2 h'), mk('ling', '15:00', 'Espanhol e inglês', '30 min')];
    else {
      const b = [mk('biblia', '05:45', 'Bíblia e meditação', '30 min')];
      if (tr) b.push(mk('treino', '17:00', 'Treino: ' + tr[0], '45 min'));
      b.push(mk('expl', '18:30', 'Explicações'));
      b.push(mk('estudo', '19:30', w === 1 || w === 3 ? 'BYU-Pathway' : 'Programação', '1 h 30'));
      b.push(mk('ling', '21:00', 'Espanhol e inglês', '15 min de cada'));
      b.push(mk('prep', '21:30', 'Preparar o dia seguinte', 'Dormir às 22:00'));
      o[w] = b;
    }
  }
  return o;
}

const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const okTime = (t) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t);
const norm = (t) => { const [h, m] = t.split(':'); return h.padStart(2, '0') + ':' + m; };

async function reschedule(sched) {
  try {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rotina', { name: 'Rotina', importance: Notifications.AndroidImportance.HIGH });
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const w of Object.keys(sched)) {
      for (const b of sched[w]) {
        if (!okTime(b.t)) continue;
        const [h, m] = b.t.split(':').map(Number);
        await Notifications.scheduleNotificationAsync({
          content: { title: b.n, body: b.s || 'Está na hora.' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: Number(w) + 1, hour: h, minute: m, channelId: 'rotina' },
        });
      }
    }
  } catch (e) {}
}

export default function App() {
  const dark = useColorScheme() === 'dark';
  const c = dark
    ? { bg: '#0E1613', card: '#16211D', ink: '#E7F0EB', mut: '#98A9A1', line: '#263530', acc: '#3DD9B4', on: '#06231C', sun: '#F0B93A' }
    : { bg: '#EEF2EF', card: '#FFFFFF', ink: '#13201B', mut: '#5B6B64', line: '#D5DDD8', acc: '#0B6E5F', on: '#FFFFFF', sun: '#C98A00' };
  const [ready, setReady] = useState(false);
  const [sched, setSched] = useState(defaults());
  const [done, setDone] = useState({});
  const [sets, setSets] = useState({});
  const [tab, setTab] = useState('hoje');
  const [ed, setEd] = useState(new Date().getDay());

  useEffect(() => {
    (async () => {
      try {
        const r = await AsyncStorage.getItem('rotina:v2');
        if (r) { const j = JSON.parse(r); setSched(j.sched || defaults()); setDone(j.done || {}); setSets(j.sets || {}); }
      } catch (e) {}
      setReady(true);
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem('rotina:v2', JSON.stringify({ sched, done, sets })).catch(() => {});
    const t = setTimeout(() => reschedule(sched), 800);
    return () => clearTimeout(t);
  }, [sched, done, sets, ready]);

  const today = new Date(), tk = dkey(today), w = today.getDay();
  const pct = (d) => { const bl = sched[d.getDay()] || [], dn = done[dkey(d)] || {}; return bl.length ? Math.round(100 * bl.filter((x) => dn[x.id]).length / bl.length) : 0; };
  const streak = () => { const d = new Date(); let n = 0; if (pct(d) < 70) d.setDate(d.getDate() - 1); for (let i = 0; i < 400 && pct(d) >= 70; i++) { n++; d.setDate(d.getDate() - 1); } return n; };
  const toggle = (id) => setDone((p) => ({ ...p, [tk]: { ...(p[tk] || {}), [id]: !(p[tk] || {})[id] } }));
  const setTog = (ei, si) => {
    const t = WK[w]; if (!t) return;
    const cur = { ...(sets[tk] || {}) }; const a = [...(cur[ei] || [])]; a[si] = !a[si]; cur[ei] = a;
    setSets((p) => ({ ...p, [tk]: cur }));
    const all = EX[t[1]].every((e, i) => { const r = cur[i] || []; for (let j = 0; j < e[2]; j++) if (!r[j]) return false; return true; });
    setDone((p) => ({ ...p, [tk]: { ...(p[tk] || {}), treino: all } }));
  };
  const upd = (i, f, v) => setSched((p) => ({ ...p, [ed]: p[ed].map((b, k) => (k === i ? { ...b, [f]: v } : b)) }));
  const fix = (i) => { const b = sched[ed][i]; if (okTime(b.t)) upd(i, 't', norm(b.t)); };
  const add = () => setSched((p) => ({ ...p, [ed]: [...p[ed], mk('x' + Date.now(), '12:00', 'Novo bloco')].sort((a, b) => a.t.localeCompare(b.t)) }));
  const del = (i) => setSched((p) => ({ ...p, [ed]: p[ed].filter((_, k) => k !== i) }));

  const S = {
    h1: { fontSize: 30, fontWeight: '800', color: c.ink },
    sub: { color: c.mut, fontSize: 14, marginTop: 4 },
    card: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    btn: { borderColor: c.line, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: c.card },
    inp: { color: c.ink, borderBottomColor: c.line, borderBottomWidth: 1, paddingVertical: 4 },
  };

  const hoje = () => {
    const bl = sched[w] || [], dn = done[tk] || {}, p = pct(today);
    return (
      <View>
        <View style={{ ...S.row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View><Text style={S.h1}>{DN[w]}</Text><Text style={S.sub}>{today.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={{ fontSize: 34, fontWeight: '800', color: c.sun }}>{streak()}</Text><Text style={{ color: c.mut, fontSize: 12 }}>dias seguidos (70% ou mais)</Text></View>
        </View>
        <View style={{ height: 10, backgroundColor: c.line, borderRadius: 6, marginTop: 16, overflow: 'hidden' }}><View style={{ width: p + '%', height: 10, backgroundColor: c.acc }} /></View>
        <Text style={S.sub}>{p}% do dia cumprido</Text>
        {bl.map((x) => (
          <Pressable key={x.id} onPress={() => toggle(x.id)} style={{ ...S.card, ...S.row, opacity: dn[x.id] ? 0.6 : 1 }}>
            <Text style={{ color: c.mut, fontWeight: '600', width: 46 }}>{x.t}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '600', textDecorationLine: dn[x.id] ? 'line-through' : 'none' }}>{x.n}</Text>
              {!!x.s && <Text style={{ color: c.mut, fontSize: 13 }}>{x.s}</Text>}
            </View>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: dn[x.id] ? c.acc : c.line, backgroundColor: dn[x.id] ? c.acc : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {dn[x.id] && <Text style={{ color: c.on }}>✓</Text>}
            </View>
          </Pressable>
        ))}
        <Text style={{ ...S.sub, marginTop: 14 }}>Nos dias difíceis, faz só o mínimo: 10 flexões, 5 min de espanhol, 1 capítulo, 20 min de código.</Text>
      </View>
    );
  };

  const treino = () => {
    const t = WK[w];
    if (!t) return (<View><Text style={S.h1}>Treino</Text><View style={S.card}><Text style={{ color: c.mut }}>Hoje é dia de descanso. O músculo cresce enquanto recuperas.</Text></View></View>);
    return (
      <View>
        <Text style={S.h1}>{t[0]}</Text>
        <Text style={S.sub}>Pára com 1 a 2 repetições na reserva. Desce devagar.</Text>
        {EX[t[1]].map((e, i) => (
          <View key={i} style={S.card}>
            <Text style={{ color: c.ink, fontWeight: '600' }}>{e[0]}</Text>
            <Text style={{ color: c.mut }}>{e[1]}</Text>
            <View style={{ ...S.row, gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {Array.from({ length: e[2] }).map((_, j) => {
                const on = ((sets[tk] || {})[i] || [])[j];
                return (<Pressable key={j} onPress={() => setTog(i, j)} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: on ? c.acc : c.line, backgroundColor: on ? c.acc : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: on ? c.on : c.ink, fontWeight: '600' }}>{j + 1}</Text></Pressable>);
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const horarios = () => (
    <View>
      <Text style={S.h1}>Horários</Text>
      <Text style={S.sub}>Usa o formato 05:45. As notificações atualizam sozinhas.</Text>
      <View style={{ ...S.row, gap: 6, marginTop: 12 }}>
        {DS.map((d, i) => (<Pressable key={i} onPress={() => setEd(i)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: ed === i ? c.acc : c.card, borderWidth: 1, borderColor: c.line }}><Text style={{ color: ed === i ? c.on : c.ink, fontWeight: '600' }}>{d}</Text></Pressable>))}
      </View>
      <Text style={{ ...S.sub, marginTop: 10 }}>{DN[ed]}</Text>
      {(sched[ed] || []).map((b, i) => (
        <View key={b.id} style={{ ...S.card, ...S.row }}>
          <TextInput value={b.t} onChangeText={(v) => upd(i, 't', v)} onEndEditing={() => fix(i)} keyboardType="numbers-and-punctuation" maxLength={5} style={{ ...S.inp, width: 60, borderBottomColor: okTime(b.t) ? c.line : '#D33' }} />
          <TextInput value={b.n} onChangeText={(v) => upd(i, 'n', v)} style={{ ...S.inp, flex: 1 }} />
          <Pressable onPress={() => del(i)}><Text style={{ color: c.mut, fontSize: 20, paddingHorizontal: 6 }}>✕</Text></Pressable>
        </View>
      ))}
      <Pressable onPress={add} style={{ ...S.btn, marginTop: 12, alignSelf: 'flex-start' }}><Text style={{ color: c.ink, fontWeight: '600' }}>+ Novo bloco</Text></Pressable>
    </View>
  );

  const semana = () => {
    const a = []; for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); a.push(x); }
    const ps = a.map(pct);
    return (
      <View>
        <Text style={S.h1}>Semana</Text>
        <Text style={S.sub}>Percentagem cumprida nos últimos 7 dias</Text>
        <View style={{ ...S.row, alignItems: 'flex-end', height: 140, marginTop: 12 }}>
          {a.map((x, i) => (<View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}><Text style={{ color: c.mut, fontSize: 12 }}>{ps[i]}</Text><View style={{ width: '100%', height: Math.max(ps[i], 2) + '%', backgroundColor: c.acc, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} /><Text style={{ color: c.mut, fontSize: 12 }}>{DS[x.getDay()]}</Text></View>))}
        </View>
        <Text style={{ color: c.ink, marginTop: 10 }}>Média: {Math.round(ps.reduce((s, v) => s + v, 0) / 7)}%</Text>
        <Pressable onPress={() => { setDone({}); setSets({}); }} style={{ ...S.btn, marginTop: 16, alignSelf: 'flex-start' }}><Text style={{ color: c.ink, fontWeight: '600' }}>Apagar histórico</Text></Pressable>
      </View>
    );
  };

  const tabs = [['hoje', 'Hoje', hoje], ['treino', 'Treino', treino], ['hor', 'Horários', horarios], ['sem', 'Semana', semana]];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {tabs.find((t) => t[0] === tab)[2]()}
      </ScrollView>
      <View style={{ flexDirection: 'row', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line }}>
        {tabs.map((t) => (<Pressable key={t[0]} onPress={() => setTab(t[0])} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderTopWidth: 3, borderTopColor: tab === t[0] ? c.acc : 'transparent' }}><Text style={{ color: tab === t[0] ? c.acc : c.mut, fontWeight: '600' }}>{t[1]}</Text></Pressable>))}
      </View>
    </SafeAreaView>
  );
}
