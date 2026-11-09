import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { PassengerMatch, searchPassengers } from '../api/passengersApi';
import { AttachmentImage } from '../components/AttachmentImage';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useT } from '@/shared/hooks/useT';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { notify } from '@/shared/utils/notify';

/** Lo mínimo para buscar: con una letra todo coincide y el resultado no informa. */
const MIN_CHARS = 2;

/** Consulta §6.17: en qué operaciones viajó una persona, por documento o nombre. */
export function PassengersSearchPage() {
  const t = useT();
  const [text, setText] = useState('');
  const q = useDebounce(text.trim(), 300);
  const [results, setResults] = useState<PassengerMatch[] | null>(null);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void searchPassengers(q).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setResults(res.data);
      else notify.fromApiError(res);
    });
    // Una respuesta lenta de una búsqueda anterior no debe pisar la actual.
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-extrabold">{t('passengerSearch.title')}</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="passenger-search-input"
          className="pl-9"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('passengerSearch.placeholder')}
          aria-label={t('passengerSearch.placeholder')}
        />
      </div>

      {results === null && !isLoading && (
        <p className="text-sm text-muted-foreground">{t('passengerSearch.hint')}</p>
      )}
      {results?.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="passenger-no-results">
          {t('passengerSearch.none')}
        </p>
      )}

      {results?.map((person) => (
        <Card key={person.document}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              {person.passport ? (
                <AttachmentImage
                  ticketId={person.passport.ticket_id}
                  fileId={person.passport.file_id}
                  name={t('passengers.passport')}
                  zoom
                  className="h-12 w-12 rounded-md border border-border"
                />
              ) : (
                <UserRound className="h-6 w-6 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{person.full_name}</p>
                <p className="data text-xs text-muted-foreground">
                  {person.document}
                  {person.nationality ? ` · ${person.nationality}` : ''}
                </p>
              </div>
              <Badge>{t('passengerSearch.trips', { count: person.operations.length })}</Badge>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {person.operations.map((op) => (
                <li key={op.id}>
                  <Link
                    to={`/tickets/${op.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="data font-medium">{op.code}</span>
                    <span className="text-muted-foreground">{op.date}</span>
                    <span className="min-w-0 flex-1 truncate">{op.route}</span>
                    <span className="text-xs text-muted-foreground">{op.status_name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
