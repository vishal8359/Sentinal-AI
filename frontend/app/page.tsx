import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/incidents/demo-incident');
  return null;
}
