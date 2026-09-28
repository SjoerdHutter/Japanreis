import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive } from 'lucide-react';
import { lees, schrijf } from '@/data/db/idb';
import { herinnerAanBackup } from '@/domein/backup/backup';
import { Kaartje } from '@/ui/basis';

/**
 * Een zacht zetje als de laatste backup meer dan drie dagen oud is en er sinds
 * die tijd iets bij kwam. Met "later" is hij een dag stil; niet voor altijd,
 * want een telefoon die in een trein blijft liggen neemt alles mee.
 */
export const BackupHerinnering = () => {
  const [tonen, setTonen] = useState(false);
  const [nooit, setNooit] = useState(false);

  useEffect(() => {
    let levend = true;
    void Promise.all([
      lees('backup.laatste'),
      lees('data.gewijzigdOp'),
      lees('backup.uitgesteldTot'),
    ]).then(([laatste, gewijzigd, uitgesteld]) => {
      if (!levend) return;
      const nu = new Date();
      if (uitgesteld && Date.parse(uitgesteld) > nu.getTime()) return;
      setNooit(!laatste);
      setTonen(herinnerAanBackup(laatste, gewijzigd, nu));
    });
    return () => {
      levend = false;
    };
  }, []);

  if (!tonen) return null;

  const later = () => {
    setTonen(false);
    void schrijf('backup.uitgesteldTot', new Date(Date.now() + 86_400_000).toISOString());
  };

  return (
    <section className="mb-6">
      <Kaartje className="flex items-start gap-3 p-3.5">
        <Archive
          className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
          aria-hidden
        />
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p className="font-medium">
            {nooit ? 'Nog geen backup gemaakt' : 'Tijd voor een nieuwe backup'}
          </p>
          <p className="text-inkt-zacht dark:text-papier/65">
            {nooit
              ? 'Je gegevens staan alleen op deze telefoon. Een backup in iCloud Drive kost een minuut.'
              : 'Sinds je laatste backup is er het een en ander bijgekomen.'}
          </p>
          <p className="mt-1.5 flex gap-4">
            <Link
              to="/backup"
              className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              Backup maken
            </Link>
            <button type="button" onClick={later} className="text-inkt-zacht underline">
              later
            </button>
          </p>
        </div>
      </Kaartje>
    </section>
  );
};
