import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { CHANNELS, customerFormSchema, type CustomerForm } from '@/modules/customers/domain/customer';
import { useDataset, useSaveCustomer } from '@/modules/customers/presentation/hooks';
import { todayIso } from '@/core/utils/dates';
import { DatePicker } from '@/shared/components/pickers';
import { Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from '@/shared/components/ui';

const EMPTY: CustomerForm = { id: '', empresa: '', ciudad: '', sector: '', contacto: '', email: '', telefono: '', canal: 'Correo', fechaAlta: '' };

export default function CustomerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const { data, isLoading } = useDataset();
  const save = useSaveCustomer();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CustomerForm>({ resolver: zodResolver(customerFormSchema), defaultValues: EMPTY });

  useEffect(() => {
    const c = data?.views.find((v) => v.id === id);
    if (c) reset({ id: c.id, empresa: c.empresa, ciudad: c.ciudad, sector: c.sector, contacto: c.contacto, email: c.email, telefono: c.telefono, canal: (CHANNELS as readonly string[]).includes(c.canal) ? (c.canal as CustomerForm['canal']) : 'Correo', fechaAlta: c.fechaAlta ?? '' });
  }, [data, id, reset]);

  if (isLoading) return <LoadingState />;
  if (!isNew && data && !data.views.some((v) => v.id === id)) return <ErrorState message="Cliente no encontrado" />;

  const onSubmit = handleSubmit(async (f) => {
    setError(null);
    try {
      const c = await save.mutateAsync({ form: f, isNew });
      router.replace({ pathname: '/clientes/[id]', params: { id: c.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  });

  const field = (name: keyof CustomerForm, label: string, extra: object = {}) => (
    <Controller control={control} name={name} render={({ field: f }) => (
      <Input className="flex-1 min-w-[220px]" label={label} value={f.value ?? ''} onChangeText={f.onChange} onBlur={f.onBlur} error={errors[name]?.message} {...extra} />
    )} />
  );

  return (
    <View className="gap-4 max-w-3xl">
      <PageHeader title={isNew ? 'Nuevo cliente' : 'Editar cliente'} subtitle="Los indicadores y segmentos se recalculan al guardar" />
      <Card className="gap-4">
        <View className="flex-row flex-wrap gap-4">
          {field('id', 'Identificador *', { editable: isNew, autoCapitalize: 'characters' })}
          {field('empresa', 'Nombre de la empresa *')}
        </View>
        <View className="flex-row flex-wrap gap-4">{field('ciudad', 'Ciudad *')}{field('sector', 'Sector económico *')}</View>
        <View className="flex-row flex-wrap gap-4">{field('contacto', 'Contacto principal')}{field('email', 'Correo electrónico', { keyboardType: 'email-address', autoCapitalize: 'none' })}</View>
        <View className="flex-row flex-wrap gap-4">
          {field('telefono', 'Teléfono', { keyboardType: 'phone-pad' })}
          <Controller control={control} name="fechaAlta" render={({ field: f }) => (
            <DatePicker className="flex-1 min-w-[220px]" label="Fecha de alta" value={f.value ?? ''} onChange={f.onChange} error={errors.fechaAlta?.message} allowClear max={todayIso()} />
          )} />
        </View>
        <Controller control={control} name="canal" render={({ field: f }) => (
          <Select label="Canal de comunicación preferido *" value={f.value} options={CHANNELS} onChange={(v) => v && f.onChange(v)} error={errors.canal?.message} />
        )} />
        {error ? <ErrorState message={error} /> : null}
        <View className="flex-row gap-2">
          <Button label="Guardar" icon={Save} onPress={onSubmit} loading={save.isPending} />
          <Button label="Cancelar" variant="secondary" onPress={() => router.back()} />
        </View>
      </Card>
    </View>
  );
}
